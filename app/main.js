// app/main.js

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let map;
let markerLayer;
let clickTempMarker;
let nearbySearchMode = false;
let nearbyCenterMarker = null;
let nearbyCircle = null;
const markerMap = new Map();

proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs");

function twd97ToWgs84(e, n) { 
	return { 
		lng: proj4("EPSG:3826", "EPSG:4326", [Number(e), Number(n)])[0], 
		lat: proj4("EPSG:3826", "EPSG:4326", [Number(e), Number(n)])[1] 
	}; 
}
function wgs84ToTwd97(lng, lat) { 
	return { 
		e: proj4("EPSG:4326", "EPSG:3826", [Number(lng), Number(lat)])[0], 
		n: proj4("EPSG:4326", "EPSG:3826", [Number(lng), Number(lat)])[1] 
	}; 
}

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([23.6978, 120.9605], 7);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    map.on('click', function (event) {
		
		const { lat, lng } = event.latlng;

		// 附近點位查詢模式
		if (nearbySearchMode) {
			UI.searchNearbyByMapClick(lat, lng);
			return;
		}

		if (!document.getElementById('form-drawer').classList.contains('open')) return;

		const { e, n } = wgs84ToTwd97(lng, lat);
		document.getElementById('p_e').value = e.toFixed(3);
		document.getElementById('p_n').value = n.toFixed(3);
		
		if (clickTempMarker) map.removeLayer(clickTempMarker);
		clickTempMarker = L.marker([lat, lng]).addTo(map).bindPopup('自動填寫位置').openPopup();
	});
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    UI.refresh();

    // 點位表單提交
    document.getElementById('point-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-point-id').value;
        const formData = {
            point_name: document.getElementById('p_name').value, point_no: document.getElementById('p_no').value,
            point_type: document.getElementById('p_grade').value, n: parseFloat(document.getElementById('p_n').value),
            e: parseFloat(document.getElementById('p_e').value), h: parseFloat(document.getElementById('p_h').value),
            epsg_id: parseInt(document.getElementById('p_epsg').value), h_ellipsoid: parseFloat(document.getElementById('p_h_ell').value),
            import_user: document.getElementById('p_user').value,
            survey_unit: document.getElementById('p_unit').value || null,
            remark: document.getElementById('p_remark').value || ""
        };
        try { await PointsModule.save(id, formData); UI.closePointDrawer(); UI.refresh(); } 
        catch (err) { alert('點位儲存失敗: ' + err.message); }
    });

    // 紀錄表單提交
    document.getElementById('record-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rid = document.getElementById('edit-record-id').value;
        const photoFile = document.getElementById('r_photo_file').files[0];
        const formData = {
            point_no: document.getElementById('target-point-no').value, survey_time: document.getElementById('r_time').value,
            inspector_id: document.getElementById('r_inspector').value, status: document.getElementById('r_status').value, remark: document.getElementById('r_remark').value
        };
        try {
            document.getElementById('r-submit').disabled = true; 
            document.getElementById('r-submit').innerText = "處理中...";
            await RecordsModule.save(rid, formData, photoFile, UI.currentPointName);
            UI.closeModal('record-modal'); 
            UI.refresh();
        } catch (err) { 
            alert('紀錄儲存失敗: ' + err.message); 
        } finally { 
            document.getElementById('r-submit').disabled = false; 
            document.getElementById('r-submit').innerText = "儲存紀錄"; 
            document.getElementById('upload-status').innerText = ""; 
        }
    });

    // 人員表單提交
    document.getElementById('inspector-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = { inspector_id: document.getElementById('ins_id').value, name: document.getElementById('ins_name').value, unit: document.getElementById('ins_unit_select').value, phone: document.getElementById('ins_phone').value };
        try { await InspectorModule.save(document.getElementById('edit-inspector-id').value === "true", formData); UI.resetInspectorForm(); UI.refresh(); } 
        catch (err) { alert('儲存失敗: ' + err.message); }
    });

    // 單位表單提交
    document.getElementById('unit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = { survey_unit: document.getElementById('u_name').value, website: document.getElementById('u_web').value, phone: document.getElementById('u_phone').value, address: document.getElementById('u_addr').value };
        try { await SurveyUnitModule.save(document.getElementById('edit-unit-id').value === "true", formData); UI.resetUnitForm(); UI.refresh(); } 
        catch (err) { alert('儲存失敗: ' + err.message); }
    });
});

const UI = {
    currentPointName: '',
	
	// 監控按鈕點按及窗口開關
    toggleInline(panelId, btnId) {
        const panel = document.getElementById(panelId);
        const btn = document.getElementById(btnId);
        const isOpening = panel.style.display === 'none' || !panel.style.display;

        ['unit-inline', 'inspector-inline', 'spatial-inline', 'unupdated-inline', 'nearby-inline'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        ['btn-unit', 'btn-inspector', 'btn-spatial', 'btn-unupdated', 'btn-nearby'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        nearbySearchMode = false;

        if (isOpening) {
            panel.style.display = 'block';
            btn.classList.add('active');

            if (panelId === 'inspector-inline') {
                this.resetInspectorForm();
            } 
            else if (panelId === 'unit-inline') {
                this.resetUnitForm();
            }
			
			else if (panelId === 'spatial-inline') {
				document.getElementById('spatial-msg').innerText = '';
				this.initSpatialDropdowns();
			}

            this.refresh();
        }
    },
	
	// 村里界線功能

	// 查詢行政區與村里名稱
	async getDistrictText(e, n) {
		try {
			const { data, error } = await sbClient.rpc('get_district_by_twd97', {
				e_coord: parseFloat(e),
				n_coord: parseFloat(n)
			});
			if (error) throw error;
			if (data && data.length > 0) {
				// 回傳資料庫回傳的 縣市 + 鄉鎮區 + 村里
				return `${data[0].county}${data[0].town}${data[0].village}`;
			}
			return "臺灣本島區外或海域";
		} catch (err) {
			console.error("行政區空間查詢失敗:", err);
			return "查詢失敗";
		}
	},

	async initSpatialDropdowns() {
        const townSelect = document.getElementById('spatial_town');
        const villageSelect = document.getElementById('spatial_village');
        townSelect.innerHTML = '<option value="">-- 請選擇鄉鎮市區 --</option>';
        villageSelect.innerHTML = '<option value="">-- 請先選擇行政區 --</option>';
        
        try {
			// 向 View 撈取已經 unique 和排序的資料
			const { data, error } = await sbClient
				.from('view_unique_towns')
				.select('town_name');
				
			if (error) throw error;
			
			const uniqueTowns = data.map(item => item.town_name).filter(Boolean);
			
			uniqueTowns.forEach(town => {
				townSelect.innerHTML += `<option value="${town}">${town}</option>`;
			});
		} catch (err) {
			console.error('無法初始化行政區選單:', err);
		}
    },

    // 當選擇了某個「區」，動態更新對應的「里」名單
    async onTownChange() {
        const townName = document.getElementById('spatial_town').value;
        const villageSelect = document.getElementById('spatial_village');
        villageSelect.innerHTML = '<option value="">-- 請選擇村里 --</option>';
        
        if (!townName) {
            villageSelect.innerHTML = '<option value="">-- 請先選擇行政區 --</option>';
            return;
        }
        
        try {
            const { data, error } = await sbClient
                .from('taiwan_districts')
                .select('village_name')
                .eq('town_name', townName);
                
            if (error) throw error;
            
            // 過濾出不重複的村里名稱
            const uniqueVillages = [...new Set(data.map(item => item.village_name))].filter(Boolean);
            
            uniqueVillages.forEach(vill => {
                if (vill && vill !== 'null') {
                    villageSelect.innerHTML += `<option value="${vill}">${vill}</option>`;
                }
            });
        } catch (err) {
            console.error('無法加載村里選單:', err);
        }
    },

    // 依照選擇的 區/里，使用後端優化過的 RPC 進行秒殺級篩選
    async filterPointsByDistrict() {
        const town = document.getElementById('spatial_town').value;
        const village = document.getElementById('spatial_village').value;
        const msgBox = document.getElementById('spatial-msg');
        const listDiv = document.getElementById('data-list');
        
        if (!town) {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '請至少選擇一個行政區！';
            return;
        }
        
        msgBox.style.color = '#333';
        msgBox.innerText = '正在進行空間篩選...';
        
        try {
            //  Spatial Join
            const { data: filteredPoints, error } = await sbClient.rpc('filter_points_by_district_rpc', {
                target_town: town,
                target_village: village || null
            });
            
            if (error) throw error;
            
            // 由於核心 PointsModule.getAll 會附帶 record 資料，我們需要為篩選出來的點補上 record 防呆（如果需要顯示歷史紀錄）
            // 如果暫時不需要在卡片顯示紀錄，可以直接傳 filteredPoints
            const { data: allPoints } = await sbClient.from('points').select('*, record(*)');
            const enrichedPoints = filteredPoints.map(fp => allPoints.find(ap => ap.id === fp.id)).filter(Boolean);
            
            // 3. 渲染地圖與列表
            this.renderList(enrichedPoints, listDiv);
            this.renderMapMarkers(enrichedPoints);
            
            msgBox.style.color = '#27ae60';
            msgBox.innerHTML = `篩選完成：位於 <b>${town}${village || ''}</b> 內共有 <b>${enrichedPoints.length}</b> 個控制點。`;
            
        } catch (err) {
            console.error('區域點位篩選失敗:', err);
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '篩選失敗，請檢查資料庫。';
        }
    },
	
	// 💥 新增：重置空間檢索條件、清空提示字並還原全部點位
    clearSpatialQuery() {
        // 1. 將行政區下拉選單與村里選單還原到預設初始狀態
        document.getElementById('spatial_town').value = "";
        document.getElementById('spatial_village').innerHTML = '<option value="">-- 請先選擇行政區 --</option>';
        
        // 2. 清空提示文字
        const msgBox = document.getElementById('spatial-msg');
        if (msgBox) msgBox.innerText = "";
        
        // 3. 重新整理刷新載入全圖點位數據
        this.refresh();
    },
	
    async findUnupdatedPoints() {
        const startDate = document.getElementById('q_start_date').value;
        const endDate = document.getElementById('q_end_date').value;
        const msgBox = document.getElementById('unupdated-msg');
        const listDiv = document.getElementById('data-list');

        if (!startDate || !endDate) {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '請選擇完整的開始與結束日期！';
            return;
        }

        msgBox.style.color = '#333';
        msgBox.innerText = '查詢中...';

        try {
            // 1. 取得所有點位資料
            const allPoints = await PointsModule.getAll('');

            // 2. 轉換為時間戳記方便比對
            const start = new Date(`${startDate}T00:00:00`).getTime();
            const end = new Date(`${endDate}T23:59:59`).getTime();

            // 3. 過濾出在該時段內「沒有」任何紀錄的點位
            const unupdatedPoints = allPoints.filter(p => {
                if (!p.record || p.record.length === 0) return true;
                
                const hasUpdateInPeriod = p.record.some(r => {
                    const rTime = new Date(r.survey_time).getTime();
                    return rTime >= start && rTime <= end;
                });
                
                return !hasUpdateInPeriod;
            });

            // 4. 呼叫現有的渲染函式更新畫面與地圖
            this.renderList(unupdatedPoints, listDiv);
            this.renderMapMarkers(unupdatedPoints);

            // ==========================================
            // [修改部分] 讓畫面上直接顯示未維護的點位名單
            // ==========================================
            msgBox.style.color = '#27ae60';
            
            if (unupdatedPoints.length > 0) {
                msgBox.innerHTML = `查詢完成：共有 <b>${unupdatedPoints.length}</b> 個點位未在此區間更新。<br>
                    <span style="color: #d35400; font-size: 0.9em; margin-top: 5px; display: inline-block;">
                    </span>`;
            } else {
                msgBox.innerText = `查詢完成：在此區間內，所有點位皆有維護紀錄！`;
            }

        } catch (error) {
            console.error("查詢發生錯誤:", error);
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '查詢失敗，請檢查 Console 報錯。';
        }
    },

    clearUnupdatedQuery() {
    document.getElementById("q_start_date").value = "";
    document.getElementById("q_end_date").value = "";

    const msg = document.getElementById("unupdated-msg");
    if (msg) msg.innerText = "";

    this.refresh();
    },
    enableNearbySearch() {
        const radius = Number(document.getElementById('nearby_radius').value);

        if (!radius || radius <= 0) {
            alert('請輸入有效的搜尋半徑，例如 500');
            return;
        }

        nearbySearchMode = true;

        const msgBox = document.getElementById('nearby-msg');
        msgBox.style.color = '#333';
        msgBox.innerText = `請在地圖上點選位置，系統會查詢 ${radius} 公尺內的控制點。`;
    },

    async searchNearbyByMapClick(lat, lng) {
        nearbySearchMode = false;
        await this.searchNearby(lat, lng);
    },

    useCurrentLocationForNearby() {
        const radius = Number(document.getElementById('nearby_radius').value);

        if (!radius || radius <= 0) {
            alert('請輸入有效的搜尋半徑，例如 500');
            return;
        }

        const msgBox = document.getElementById('nearby-msg');

        if (!navigator.geolocation) {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '此瀏覽器不支援定位功能。';
            return;
        }

        msgBox.style.color = '#333';
        msgBox.innerText = '正在取得目前位置...';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                await this.searchNearby(lat, lng);
            },
            (error) => {
                msgBox.style.color = '#e74c3c';
                msgBox.innerText = '無法取得目前位置，請確認瀏覽器定位權限是否開啟。';
                console.error(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    async searchNearby(lat, lng) {
        const radius = Number(document.getElementById('nearby_radius').value);
        const msgBox = document.getElementById('nearby-msg');
        const listDiv = document.getElementById('data-list');

        if (!radius || radius <= 0) {
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '請輸入有效的搜尋半徑。';
            return;
        }

        msgBox.style.color = '#333';
        msgBox.innerText = '查詢中...';

        try {
            const center = wgs84ToTwd97(lng, lat);
            const allPoints = await PointsModule.getAll('');

            const nearbyPoints = allPoints
                .map(p => {
                    if (!p.e || !p.n) return null;

                    const distance = Math.sqrt(
                        Math.pow(Number(p.e) - Number(center.e), 2) +
                        Math.pow(Number(p.n) - Number(center.n), 2)
                    );

                    return {
                        ...p,
                        distance_m: distance
                    };
                })
                .filter(p => p && p.distance_m <= radius)
                .sort((a, b) => a.distance_m - b.distance_m);

            this.renderList(nearbyPoints, listDiv);
            this.renderMapMarkers(nearbyPoints);
            this.drawNearbyCircle(lat, lng, radius);

            msgBox.style.color = '#27ae60';
            msgBox.innerHTML = `
                查詢完成：以點選位置為圓心，半徑 <b>${radius}</b> 公尺內共有 
                <b>${nearbyPoints.length}</b> 個控制點。
            `;

            if (nearbyPoints.length === 0) {
                listDiv.innerHTML = "<p style='text-align:center;'>此範圍內沒有控制點</p>";
            }

        } catch (error) {
            console.error('附近查詢失敗:', error);
            msgBox.style.color = '#e74c3c';
            msgBox.innerText = '附近查詢失敗，請檢查 Console 報錯。';
        }
    },

    drawNearbyCircle(lat, lng, radius) {
        if (nearbyCenterMarker) {
            map.removeLayer(nearbyCenterMarker);
            nearbyCenterMarker = null;
        }

        if (nearbyCircle) {
            map.removeLayer(nearbyCircle);
            nearbyCircle = null;
        }

        nearbyCenterMarker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup('查詢中心點')
            .openPopup();

        nearbyCircle = L.circle([lat, lng], {
            radius: radius
        }).addTo(map);

        map.fitBounds(nearbyCircle.getBounds(), {
            padding: [40, 40]
        });
    },

    clearNearbySearch() {
        nearbySearchMode = false;

        const msgBox = document.getElementById('nearby-msg');
        if (msgBox) msgBox.innerText = '';

        if (nearbyCenterMarker) {
            map.removeLayer(nearbyCenterMarker);
            nearbyCenterMarker = null;
        }

        if (nearbyCircle) {
            map.removeLayer(nearbyCircle);
            nearbyCircle = null;
        }

        this.refresh();
    },
	// 打開或關閉右邊抽屜 (點位編輯窗)
    openPointDrawer(isEdit = false) {
        if (!isEdit) this.resetPointForm(); 
        document.getElementById('form-drawer').classList.add('open');
    },
	
    closePointDrawer() {
        document.getElementById('form-drawer').classList.remove('open');
        if (clickTempMarker) { map.removeLayer(clickTempMarker); clickTempMarker = null; }
    },
	
	// 打開或關閉中央的彈出窗口 (歷史紀錄編輯窗)
    openModal(id) { document.getElementById(id).style.display = 'block'; },
    closeModal(id) { document.getElementById(id).style.display = 'none'; },
	
	// 更新所有欄位與下拉式選單的資訊
    async refresh() {
        const listDiv = document.getElementById('data-list');
        const keyword = document.getElementById('p_search')?.value || '';
        const insDiv = document.getElementById('inspector-list');
        const unitDiv = document.getElementById('unit-list');
        const insUnitSelect = document.getElementById('ins_unit_select');
        const pUnitSelect = document.getElementById('p_unit');
        const unupdatedMsg = document.getElementById('unupdated-msg');
        if (unupdatedMsg) unupdatedMsg.innerText = '';

        try {
            const data = await PointsModule.getAll(keyword);
            this.renderList(data, listDiv);
            this.renderMapMarkers(data);

            const units = await SurveyUnitModule.getAll();
            unitDiv.innerHTML = "";
            insUnitSelect.innerHTML = '<option value="">(無)</option>';

            units.forEach(u => {
                unitDiv.innerHTML += `<div style="background:#fff; border:1px solid #ddd; padding:5px; border-radius:4px; font-size:0.85em; margin:2px;">${u.survey_unit} <button class="btn btn-warning btn-sm" onclick='UI.editUnit(${JSON.stringify(u)})'>改</button> <button class="btn btn-danger btn-sm" onclick="UI.deleteUnit('${u.survey_unit}')">刪</button></div>`;
                insUnitSelect.innerHTML += `<option value="${u.survey_unit}">${u.survey_unit}</option>`;
            });
            pUnitSelect.innerHTML = insUnitSelect.innerHTML;

            const inspectors = await InspectorModule.getAll();
            insDiv.innerHTML = "";
            inspectors.forEach(ins => {
                const displayUnit = ins.unit ? ins.unit : '(無)';
                insDiv.innerHTML += `
                    <div style="background:#f9f9f9; padding:6px 12px; border:1px solid #ccc; border-radius:4px; font-size:0.9em; margin-bottom:5px;">
                        <strong>${ins.name}</strong> - 單位: ${displayUnit}
                        <button class="btn btn-warning btn-sm" onclick='UI.editInspector(${JSON.stringify(ins)})'>改</button>
                        <button class="btn btn-danger btn-sm" onclick="UI.deleteInspector('${ins.inspector_id}')">刪</button>
                    </div>
                `;
            });
        } catch (err) { listDiv.innerHTML = '載入失敗: ' + err.message; }
    },
	
	// 將點位資料和歷史紀錄做成卡片顯示
    renderList(data, container) {
        container.innerHTML = data.length ? "" : "<p style='text-align:center;'>無資料</p>";
        data.forEach(p => {
            const card = document.createElement('div');
            card.className = 'data-card';
            card.onclick = () => this.focusPoint(p.id);
			
			card.innerHTML = `
                <h3>[${p.point_no || '未編號'}] ${p.point_name}</h3>
                <div style="font-size:12px; color:#666; margin-bottom:10px;">
                    N: ${p.n} | E: ${p.e} <br> 
                    類型: ${p.point_type || 'N/A'} | 單位: ${p.survey_unit || '(無)'}
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary btn-sm" style="margin-right: auto;" onclick="event.stopPropagation(); UI.openRecordModal('${p.point_no}', '${p.point_name}')">+調查紀錄</button>
                    <button class="btn btn-warning btn-sm" onclick='event.stopPropagation(); UI.editPoint(${JSON.stringify(p)})'>編輯點位</button>
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); UI.deletePoint(${p.id})">刪除</button>
                </div>

                <div class="record-box" onclick="event.stopPropagation();">
                    <strong>歷史紀錄：</strong>
                    ${p.record.map(r => `
                        <div class="record-item">
                            <div>
                                <span><b>#${r.log_id || '無'}</b> | ${new Date(r.survey_time).toLocaleString().split(' ')[0]}</span>
                                ${r.photo_path ? `<a href="${r.photo_path}" target="_blank" style="margin-left: 8px; font-size: 12px; text-decoration: none; background: #e5e7eb; color: #111827; padding: 2px 6px; border-radius: 4px; border: 1px solid #d1d5db;">🖼️ 查看照片</a>` : ''}
                            </div>
                            <span style="white-space:nowrap;">
                                <button class="btn btn-warning btn-sm" onclick='UI.openRecordModal("${p.point_no}", "${p.point_name}", ${JSON.stringify(r)})'>改</button>
                                <button class="btn btn-danger btn-sm" onclick="UI.deleteRecord(${r.id})">刪</button>
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(card);
        });
    },
	
	// 將點位標記到地圖上
	renderMapMarkers(data) {
        markerLayer.clearLayers(); markerMap.clear();
        const bounds = [];
        
        data.forEach(item => {
            if (!item.e || !item.n) return;
            
            const { lat, lng } = twd97ToWgs84(item.e, item.n);
            if (!lat || !lng) return;
            
            // 建立標記
            const marker = L.marker([lat, lng]).addTo(markerLayer);
            
            // 💥 修改點擊事件：當使用者點擊任何地圖點位時，動態查出村里並顯示
			// 在初始化時就預先非同步撈取行政區，並綁定好靜態 Popup
			
            this.getDistrictText(item.e, item.n).then(districtStr => {
                marker.bindPopup(`
                    <h3 style="margin: 0 0 5px 0; font-size: 15px;">[${item.point_no || '未編號'}] ${item.point_name}</h3>
                    <div style="color: #0d6efd; font-weight: bold; margin-bottom: 5px;">📍 ${districtStr}</div>
                    <div style="font-size: 12px; color: #666;">
                        N: ${item.n} | E: ${item.e}<br>
                        類型: ${item.point_type || 'N/A'}<br>
                        備註: ${item.remark || '無'}
                    </div>
                `);
            });

            markerMap.set(item.id, marker); 
            bounds.push([lat, lng]);
        });
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
    },
	
	// 將地圖聚焦到點位上
    focusPoint(id) {
        const marker = markerMap.get(id);
        if (marker) { map.setView(marker.getLatLng(), 17); marker.openPopup(); }
    },
	
	// 編輯儲存某點位的某筆調查記錄
    async openRecordModal(pointNo, pointName, r = null) {
        document.getElementById('target-point-no').value = pointNo;
        this.currentPointName = pointName;

        document.getElementById('upload-status').innerText = "";

        try {
            const insSelect = document.getElementById('r_inspector');
            const inspectors = await InspectorModule.getAll();
            insSelect.innerHTML = '<option value="" disabled selected>請選擇人員...</option>';
            inspectors.forEach(ins => { insSelect.innerHTML += `<option value="${ins.inspector_id}">${ins.name}</option>`; });
        } catch(err) {}

        // --- 2. 動態生成「狀態」下拉選單（自動同步資料庫 ENUM） ---
        try {
            const statusSelect = document.getElementById('r_status');
            
            // 呼叫我們剛剛在 Supabase 建立的 SQL 函數
            const { data: enumValues, error } = await sbClient.rpc('get_enum_values');
            
            if (error) throw error;

            statusSelect.innerHTML = '<option value="" disabled selected>請選擇狀態...</option>';
            
            // enumValues 會是例如 ['正常', '損壞', '遺失', '其他無法正常使用情形']
            enumValues.forEach(status => {
                statusSelect.innerHTML += `<option value="${status.value}">${status.value}</option>`;
            });
        } catch(err) {
            console.error('無法動態載入 ENUM 狀態:', err);
            // 防呆機制：萬一資料庫連線失敗，用原本的舊資料墊底
            const fallback = ['正常', '損壞', '遺失', '其他無法正常使用情形'];
            const statusSelect = document.getElementById('r_status');
            statusSelect.innerHTML = '<option value="">請選擇狀態...</option>';
            fallback.forEach(s => statusSelect.innerHTML += `<option value="${s}">${s}</option>`);
        }

        if (r) {
            document.getElementById('record-form-title').innerText = "編輯調查紀錄";
            document.getElementById('edit-record-id').value = r.id;
            document.getElementById('r_time').value = r.survey_time ? r.survey_time.substring(0, 16) : "";
            document.getElementById('r_inspector').value = r.inspector_id;
            document.getElementById('r_status').value = r.status;
            document.getElementById('r_remark').value = r.remark;
            document.getElementById('r-submit').innerText = "更新紀錄";
        } 
		else {
            document.getElementById('record-form-title').innerText = "新增調查紀錄";
            document.getElementById('record-form').reset();
            document.getElementById('edit-record-id').value = "";
            document.getElementById('r-submit').innerText = "儲存紀錄";
        }
        this.openModal('record-modal');
    },
	
	// 定義 點位輸入初始狀態
    resetPointForm() {
        document.getElementById('point-form').reset();
        document.getElementById('edit-point-id').value = "";
        document.getElementById('form-title').innerText = "新增點位";
        document.getElementById('p-submit').innerText = "儲存點位資料";
    },
	
	// 編輯儲存點位資料
    editPoint(p) {
        document.getElementById('edit-point-id').value = p.id;
        document.getElementById('p_name').value = p.point_name; 
		document.getElementById('p_no').value = p.point_no;
        document.getElementById('p_grade').value = p.point_type; 
		document.getElementById('p_n').value = p.n;
        document.getElementById('p_e').value = p.e; 
		document.getElementById('p_h').value = p.h;
        document.getElementById('p_h_ell').value = p.h_ellipsoid; 
		document.getElementById('p_epsg').value = p.epsg_id;
        document.getElementById('p_user').value = p.import_user;
		document.getElementById('p_unit').value = p.survey_unit || "";
		document.getElementById('p_remark').value = p.remark || "";
        document.getElementById('form-title').innerText = "編輯點位";
        document.getElementById('p-submit').innerText = "儲存修改";
        this.openPointDrawer(true);
    },
	
	// 編輯儲存調查人員
    editInspector(ins) {
        document.getElementById('edit-inspector-id').value = "true";
        document.getElementById('ins_id').value = ins.inspector_id; 
		document.getElementById('ins_id').readOnly = true;
        document.getElementById('ins_name').value = ins.name; 
		document.getElementById('ins_unit_select').value = ins.unit;
        document.getElementById('ins_phone').value = ins.phone;
        document.getElementById('ins-submit').innerText = "更新資料"; 
		document.getElementById('ins-cancel').style.display = "inline-block";
    },
	
	// 定義 調查人員輸入初始狀態
    resetInspectorForm() {
        document.getElementById('inspector-form').reset();
        document.getElementById('edit-inspector-id').value = ""; 
		document.getElementById('ins_id').readOnly = false;
        document.getElementById('ins-submit').innerText = "新增"; 
		document.getElementById('ins-cancel').style.display = "none";
    },
	
	// 編輯儲存調查機關
    editUnit(u) {
        document.getElementById('edit-unit-id').value = "true";
        document.getElementById('u_name').value = u.survey_unit; 
		document.getElementById('u_name').readOnly = true;
        document.getElementById('u_web').value = u.website; 
		document.getElementById('u_phone').value = u.phone;
        document.getElementById('u_addr').value = u.address;
        document.getElementById('u-submit').innerText = "更新資料"; 
		document.getElementById('u-cancel').style.display = "inline-block";
    },
	
	// 定義 調查機關輸入初始狀態
    resetUnitForm() {
        document.getElementById('unit-form').reset();
        document.getElementById('edit-unit-id').value = ""; 
		document.getElementById('u_name').readOnly = false;
        document.getElementById('u-submit').innerText = "儲存"; 
		document.getElementById('u-cancel').style.display = "none";
    },

    async deletePoint(id) { 
		if (confirm('確定刪除此點位？')) { 
			await PointsModule.delete(id); this.refresh(); 
		} 
	},
    async deleteRecord(id) { 
		if (confirm('確定刪除紀錄？')) { 
			await RecordsModule.delete(id); 
			this.refresh(); 
		} 
	},
    async deleteInspector(id) { 
		if (confirm('確定刪除此調查員？')) { 
			await InspectorModule.delete(id); 
			this.refresh(); 
		} 
	},
    async deleteUnit(id) { 
		if (confirm('確定刪除此單位？')) { 
			try { await SurveyUnitModule.delete(id); this.refresh(); } 
			catch(err) { alert('刪除失敗，該單位被參照中。'); } 
		} 
	}
};
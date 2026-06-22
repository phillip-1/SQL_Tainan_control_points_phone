// app/records.js

const RecordsModule = {
    table: 'record',
    bucket: 'photos',

    // 流水號：點號名稱 + 000X ---
    async generateLogId(pointName) {
        
		const prefix = (pointName || "UNKNOWN").trim();

        const { data, error } = await sbClient
            .from(this.table)
            .select('log_id')
            .like('log_id', `${prefix}%`)
            .order('log_id', { ascending: false })
            .limit(1);

        if (error || data.length === 0) {
            return prefix + "0001";
        } else {
            const lastId = data[0].log_id;
            const lastNumStr = lastId.replace(prefix, ""); 
            const lastNum = parseInt(lastNumStr) || 0;
            return prefix + (lastNum + 1).toString().padStart(4, '0');
        }
    },

    async save(rid, formData, photoFile, pointName) {
        let photoPath = formData.photo_path;

        if (photoFile) {
            document.getElementById('upload-status').innerText = "照片上傳中...";
            photoPath = await this.uploadPhoto(photoFile);
        }

        const finalData = { ...formData, photo_path: photoPath };

        if (!rid) {
            
			finalData.log_id = await this.generateLogId(pointName);
            const { error } = await sbClient.from(this.table).insert([finalData]);
            if (error) throw error;
        } else {
            const { error } = await sbClient.from(this.table).update(finalData).eq('id', rid);
            if (error) throw error;
        }
    },
    
    // 照片上傳至 Supabase Storage
    async uploadPhoto(file) {
        if (!file) return null;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `records/${fileName}`;

        const { error: uploadError } = await sbClient.storage
            .from(this.bucket)
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 取得公開 URL
        const { data } = sbClient.storage.from(this.bucket).getPublicUrl(filePath);
        return data.publicUrl;
    },

    async delete(rid) {
        const { error } = await sbClient.from(this.table).delete().eq('id', rid);
        if (error) throw error;
    }
};
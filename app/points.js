// app/points.js

const PointsModule = {
    table: 'points',

    async getAll(keyword = '') {
        let query = sbClient
            .from(this.table)
            .select('*, record(*)')
            .order('id', { ascending: false });

        // 如果有關鍵字，加入搜尋條件 (不分大小寫 ilike)
        if (keyword) {
            query = query.or(`point_name.ilike.%${keyword}%,point_no.ilike.%${keyword}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
	
    async save(id, formData) {
        const action = id 
            ? sbClient.from(this.table).update(formData).eq('id', id)
            : sbClient.from(this.table).insert([formData]);
        const { error } = await action;
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await sbClient.from(this.table).delete().eq('id', id);
        if (error) throw error;
    },
	
	async getByPointNo(pointNo) {
        const { data, error } = await sbClient
            .from(this.table)
            .select('*')
            .eq('point_no', pointNo.trim())
            .maybeSingle(); // 若找不到, 回傳 null
            
        if (error) throw error;
        return data;
    }
};
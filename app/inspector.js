// app/inspector.js

const InspectorModule = {
    table: 'INSPECTOR', 

    async getAll() {
        const { data, error } = await sbClient
            .from(this.table)
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        return data;
    },

    async save(isEdit, formData) {
        const action = isEdit 
            ? sbClient.from(this.table).update(formData).eq('inspector_id', formData.inspector_id)
            : sbClient.from(this.table).insert([formData]);
        
        const { error } = await action;
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await sbClient.from(this.table).delete().eq('inspector_id', id);
        if (error) throw error;
    }
};
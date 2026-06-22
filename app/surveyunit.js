// app/surveyunit.js

const SurveyUnitModule = {
    table: 'surveyunit',

    async getAll() {
        const { data, error } = await sbClient
            .from(this.table)
            .select('*')
            .order('survey_unit', { ascending: true });
        if (error) throw error;
        return data;
    },

    async save(isEdit, formData) {
        const action = isEdit 
            ? sbClient.from(this.table).update(formData).eq('survey_unit', formData.survey_unit)
            : sbClient.from(this.table).insert([formData]);
        
        const { error } = await action;
        if (error) throw error;
    },

    async delete(id) {
        const { error } = await sbClient.from(this.table).delete().eq('survey_unit', id);
        if (error) throw error;
    }
};
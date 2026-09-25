import api from './api';

export const dashboardService = {
  async getOverview(params?: { assessmentId?: string }) {
    const res: any = await api.get('/admin/dashboard/overview', { params });
    return res?.data || res;
  },

  async getActivity(params?: { limit?: number; assessmentId?: string }) {
    const res: any = await api.get('/admin/dashboard/activity', { params });
    return res?.data || res;
  },

  async getAssessmentSummaries(params?: { page?: number; limit?: number; search?: string }) {
    const res: any = await api.get('/admin/dashboard/assessments', { params });
    return res?.data || res;
  },

  async getMonitoring(params: { assessmentId: string; page?: number; limit?: number; status?: string; search?: string }) {
    const res: any = await api.get('/admin/monitoring', { params });
    return res?.data || res;
  },

  async getMonitoringDetail(assignmentId: string) {
    const res: any = await api.get(`/admin/monitoring/${assignmentId}`);
    return res?.data || res;
  }
};

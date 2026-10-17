export const chatService = {
  preguntar: async (pregunta, vista = null) => {
    const response = await API.post('/api/chat/preguntar', { pregunta, vista });
    return response.data;
  }
};
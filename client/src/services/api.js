import axios from "axios";

const api = axios.create({
    baseURL: `${import.meta.env.VITE_SERVER_URL}/api`,
    withCredentials: true,
});

// Request ke time acess token cookie automically send hoga
api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response intercptor 
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Agar ccess token expire ho gaya 
        if (error.response?.status === 401 && error.response?.data?.message === "Access token expired" && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Refresh token cookie automatically 
                await api.post("/auth/refresh");

                // New access token milne ke baad original request ko dobara bhejna
                return api(originalRequest);
            } catch (refreshError) {
                // Agar refresh token bhi expire ho gaya ya invalid hai, to user ko logout kar dena chahiye
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
)

export default api;
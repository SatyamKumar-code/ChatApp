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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor to automatically refresh accessToken on 401
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (!originalRequest) {
            return Promise.reject(error);
        }

        // Avoid infinite loop on auth endpoints
        const isAuthEndpoint =
            originalRequest.url?.includes("/auth/login") ||
            originalRequest.url?.includes("/auth/register") ||
            originalRequest.url?.includes("/auth/refresh") ||
            originalRequest.url?.includes("/auth/logout");

        // When access token is expired or missing (401), attempt to refresh using refreshToken
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                // Another request is already refreshing the token, wait in queue
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => api(originalRequest))
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call refresh endpoint - browser automatically sends httpOnly refreshToken cookie
                await api.post("/auth/refresh");

                // Process all queued requests that failed while refreshing
                processQueue(null);

                // Retry the original request
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh token also expired or invalid
                processQueue(refreshError, null);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
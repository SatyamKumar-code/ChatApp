import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";


const Register = () => {
    const { register } = useContext(AuthContext);

    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        password: "",
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const data = await register(formData);

            if (data.success) {
                navigate("/login");
            } else {
                setError(data.message);
            }
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute top-[-10%] left-[-5%] w-72 h-72 bg-purple-600/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-600/15 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

            {/* Register Card */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-[fadeInUp_0.6s_ease-out]">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl shadow-purple-900/20 p-8 sm:p-10">
                    {/* Logo / Brand */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                            Create Account
                        </h1>
                        <p className="text-sm text-gray-400 mt-2">
                            Join ChatApp and start chatting
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 animate-[shake_0.4s_ease-in-out]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Name Input */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Full Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 outline-none focus:border-purple-500/50 focus:bg-white/8 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Phone Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                    </svg>
                                </div>
                                <input
                                    type="tel"
                                    name="phone"
                                    placeholder="Enter your phone number"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 outline-none focus:border-purple-500/50 focus:bg-white/8 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="group">
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </div>
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Enter password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 outline-none focus:border-purple-500/50 focus:bg-white/8 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-indigo-600/25 cursor-pointer"
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Creating...
                                </span>
                            ) : "Create Account"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    </div>

                    {/* Login Link */}
                    <p className="text-center text-sm text-gray-400">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="text-purple-400 hover:text-purple-300 font-semibold transition-colors duration-200 hover:underline underline-offset-4"
                        >
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>

            {/* CSS for custom animations */}
            <style>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
            `}</style>
        </div>
    );
};

export default Register;
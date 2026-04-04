
import React, { useState } from 'react';
import { Monitor, Play, Shield, Zap, Settings, X, ExternalLink } from 'lucide-react';

const AuraPreviewBridgePlugin = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed right-4 top-1/4 z-[100] flex items-start gap-4">
            {/* Sidebar v9.8 logic UI */}
            {isOpen && (
                <div className="w-64 bg-white/95 backdrop-blur-md border border-[#F5E9E7] rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right fade-in duration-300">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F5E9E7]/50">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-orange-500" />
                            <span className="font-semibold text-gray-800 text-sm">PreviewBridge v9.8</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Status ConnectPro */}
                        <div className="bg-[#F5E9E7]/30 p-3 rounded-xl border border-[#F5E9E7]/50">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase font-bold text-orange-600">ConnectPro Status</span>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            </div>
                            <p className="text-xs text-gray-600 font-medium">Synced via SURGE mode 24/7</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-2">
                            <button className="flex flex-col items-center justify-center p-3 h-16 bg-[#F5E9E7]/10 hover:bg-[#F5E9E7]/30 border border-[#F5E9E7]/30 rounded-xl transition-all group">
                                <Monitor className="w-5 h-5 text-orange-600 mb-1" />
                                <span className="text-[9px] font-bold uppercase">Preview</span>
                            </button>
                            <button className="flex flex-col items-center justify-center p-3 h-16 bg-[#F5E9E7]/10 hover:bg-[#F5E9E7]/30 border border-[#F5E9E7]/30 rounded-xl transition-all group">
                                <Shield className="w-5 h-5 text-orange-600 mb-1" />
                                <span className="text-[9px] font-bold uppercase">Security</span>
                            </button>
                        </div>

                        {/* Active Service (Proxy) */}
                        <div className="p-2 border border-dashed border-[#F5E9E7] rounded-lg">
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold">
                                <ExternalLink className="w-3 h-3" />
                                Proxy Credential
                            </div>
                            <p className="text-xs font-mono bg-gray-50 mt-1 p-1 rounded overflow-hidden text-ellipsis italic">proxy_71ab...2ea9</p>
                        </div>

                        <button className="w-full py-2 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                            <Zap className="w-3 h-3" /> Launch Surge Watcher
                        </button>
                    </div>
                </div>
            )}

            {/* Plugin Toggle Icon — Style CloudCode/Aura */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
                    isOpen ? 'bg-orange-600 rotate-90 scale-110' : 'bg-white hover:bg-[#F5E9E7]/50 border-2 border-[#F5E9E7] active:scale-90 hover:shadow-orange-100'
                }`}
                title="PreviewBridge Plugin"
            >
                {isOpen ? (
                    <Settings className="text-white w-6 h-6" />
                ) : (
                    <div className="relative">
                        <Monitor className="text-orange-600 w-6 h-6" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
                    </div>
                )}
            </button>
        </div>
    );
};

export default AuraPreviewBridgePlugin;

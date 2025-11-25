import React, { useState, useEffect, useRef } from 'react';
import { Reservation } from './types';
import { LiveManager } from './services/liveManager';
import { MicOff, PhoneCall, Calendar, Clock, Phone, Activity, Stethoscope, PlusCircle } from 'lucide-react';

const Header = () => (
  <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50 shadow-sm">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-blue-200 shadow-lg">
          <Stethoscope className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">ДЕНТАЛНА КЛИНИКА ЗДРАВЕ</h1>
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">AI Рецепционист</p>
        </div>
      </div>
      <div className="hidden md:flex items-center space-x-2 text-slate-500 text-sm bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
        <Activity className="w-4 h-4 text-green-500" />
        <span>Системата е онлайн</span>
      </div>
    </div>
  </header>
);

const ReservationCard: React.FC<{ reservation: Reservation }> = ({ reservation }) => (
  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300 group animate-in fade-in slide-in-from-bottom-4">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
          {reservation.customerName}
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 mt-1 border border-green-200">
          Потвърден час
        </span>
      </div>
      <div className="p-2 bg-blue-50 rounded-full text-blue-600">
        <Stethoscope className="w-5 h-5" />
      </div>
    </div>
    
    <div className="space-y-3 text-sm text-slate-600">
      <div className="flex items-center space-x-3">
        <Calendar className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700 font-medium">{reservation.date}</span>
      </div>
      <div className="flex items-center space-x-3">
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700 font-medium">{reservation.time}</span>
      </div>
      <div className="flex items-center space-x-3">
        <PlusCircle className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700">{reservation.procedure}</span>
      </div>
      <div className="flex items-center space-x-3">
        <Phone className="w-4 h-4 text-slate-400" />
        <span className="text-slate-700">{reservation.phone}</span>
      </div>
    </div>
  </div>
);

const Visualizer = ({ volume, active }: { volume: number, active: boolean }) => {
  const bars = 5;
  return (
    <div className="flex items-center justify-center space-x-1 h-12">
      {[...Array(bars)].map((_, i) => {
        // Create a symmetric wave effect
        const height = active ? Math.max(6, Math.min(48, volume * (i % 2 === 0 ? 1.5 : 0.8) * 0.8)) : 4;
        return (
          <div
            key={i}
            className="w-2 bg-blue-500 rounded-full transition-all duration-100 ease-out"
            style={{ height: `${height}px`, opacity: active ? 1 : 0.3 }}
          />
        );
      })}
    </div>
  );
};

export default function App() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [volume, setVolume] = useState(0);
  
  const liveManagerRef = useRef<LiveManager | null>(null);

  useEffect(() => {
    return () => {
      if (liveManagerRef.current) {
        liveManagerRef.current.disconnect();
      }
    };
  }, []);

  const handleConnect = async () => {
    if (status === 'connected' || status === 'connecting') {
      liveManagerRef.current?.disconnect();
      return;
    }

    liveManagerRef.current = new LiveManager({
      onStatusChange: setStatus,
      onVolumeChange: setVolume,
      onReservationCreated: (data) => {
        console.log("Adding reservation to state:", data);
        const newReservation: Reservation = {
          id: Math.random().toString(36).substr(2, 9),
          ...data,
          status: 'confirmed',
          createdAt: Date.now()
        };
        setReservations(prev => [newReservation, ...prev]);
      }
    });

    await liveManagerRef.current.connect();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Voice Agent Interface */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[500px] shadow-xl shadow-slate-200/50 relative overflow-hidden">
            
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />

            <div className="relative z-10 text-center space-y-8 w-full">
              <div className="relative inline-block">
                <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 ${
                  status === 'connected' 
                    ? 'bg-blue-100 shadow-[0_0_80px_-20px_rgba(37,99,235,0.4)] ring-2 ring-blue-200' 
                    : 'bg-slate-100 ring-2 ring-slate-200'
                }`}>
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-inner ${
                     status === 'connected' ? 'bg-gradient-to-tr from-blue-500 to-blue-600' : 'bg-white'
                  }`}>
                    {status === 'connected' ? (
                      <Visualizer volume={volume} active={true} />
                    ) : (
                      <PhoneCall className="w-12 h-12 text-slate-300" />
                    )}
                  </div>
                </div>
                
                {status === 'connected' && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-xs text-white font-bold px-3 py-1 rounded-full border-4 border-white shadow-sm flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-3">
                  {status === 'connected' ? 'Разговаряте с асистента' : 'Виртуален Рецепционист'}
                </h2>
                <p className="text-slate-500 text-lg leading-relaxed max-w-xs mx-auto">
                  {status === 'connected' 
                    ? 'Асистентът слуша. Говорете за записване на час.' 
                    : 'Натиснете бутона по-долу, за да се свържете с клиниката.'}
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={status === 'connecting'}
                className={`
                  relative px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95
                  flex items-center justify-center space-x-3 w-full max-w-xs mx-auto shadow-lg
                  ${status === 'connected' 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}
                  ${status === 'connecting' ? 'opacity-80 cursor-wait' : ''}
                `}
              >
                {status === 'connecting' ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : status === 'connected' ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    <span>Прекъсни връзката</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    <span>Обади се</span>
                  </>
                )}
              </button>

              {status === 'error' && (
                <div className="text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm border border-red-100 mt-4">
                  Грешка при свързване. Моля, проверете микрофона си.
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-slate-800 font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Статус на системата
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span>Връзка:</span>
                <span className={`font-medium ${status === 'connected' ? 'text-green-600' : 'text-slate-500'}`}>
                  {status === 'connected' ? 'Активна' : 'В очакване'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Езиков модел:</span>
                <span className="text-slate-800">Български (BG)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex justify-between items-end border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">График за деня</h2>
              <p className="text-slate-500">Списък с записаните часове от асистента</p>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <span className="text-blue-600 text-sm font-medium">Пациенти: </span>
              <span className="text-blue-800 font-bold text-lg ml-1">{reservations.length}</span>
            </div>
          </div>

          <div className="h-[600px] overflow-y-auto pr-2 -mr-2">
            {reservations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <div className="w-16 h-16 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-medium text-slate-700 mb-2">Няма записани часове</h3>
                <p className="text-slate-500 max-w-sm">
                  Стартирайте гласовия асистент отляво и направете пробно обаждане, за да запишете час за преглед.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reservations.map(res => (
                  <ReservationCard key={res.id} reservation={res} />
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Room, Building } from '../../types/index.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { X, MapPin, Maximize2, Users, Check, Sparkles, Send, ShieldAlert, Cpu } from 'lucide-react';

interface RoomDetailModalProps {
  room: Room | null;
  onClose: () => void;
  onApplicationSubmitted?: () => void;
  onOpenAuthModal?: () => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({ room, onClose, onApplicationSubmitted, onOpenAuthModal }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [detailedRoom, setDetailedRoom] = useState<Room | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(false);

  // Application form state
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState(12);
  const [occupants, setOccupants] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    setLoading(true);
    setShowApplyForm(false);
    setApplySuccess(false);
    setApplyError(null);

    api.getRoomBySlug(room.slug)
      .then(res => {
        setDetailedRoom(res);
        if (res.building) setBuilding(res.building);
      })
      .catch(err => {
        console.error(err);
        setDetailedRoom(room);
      })
      .finally(() => setLoading(false));
  }, [room]);

  if (!room) return null;

  const currentRoom = detailedRoom || room;
  const amenitiesList: string[] = Array.isArray(currentRoom.amenities)
    ? currentRoom.amenities
    : typeof currentRoom.amenities === 'string'
    ? JSON.parse(currentRoom.amenities || '[]')
    : [];

  const imagesList: string[] = Array.isArray(currentRoom.images)
    ? currentRoom.images
    : typeof currentRoom.images === 'string'
    ? JSON.parse(currentRoom.images || '[]')
    : [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'
      ];

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setSubmitting(true);
    setApplyError(null);
    try {
      await api.applyForRoom({
        roomId: currentRoom.id,
        intendedStartDate: startDate,
        leaseDurationMonths: durationMonths,
        occupantsCount: occupants,
        notes
      });
      setApplySuccess(true);
      if (onApplicationSubmitted) onApplicationSubmitted();
    } catch (err: any) {
      setApplyError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const formatRoomType = (type: string) => {
    return t(`room_type.${type.toLowerCase()}`, type.replace('_', ' '));
  };

  const formatStatus = (status: string) => {
    return t(`status.${status.toLowerCase()}`, status);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="relative h-64 sm:h-80 bg-slate-900 overflow-hidden">
          <img
            src={imagesList[0]}
            alt={`Room ${currentRoom.room_number}`}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-slate-900/60 hover:bg-slate-900 text-white p-2 rounded-full backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-blue-600 text-white font-bold px-2.5 py-0.5 rounded text-xs">
                  {t('explorer.room_number')} {currentRoom.room_number}
                </span>
                <span className="bg-white/90 text-slate-800 font-semibold px-2 py-0.5 rounded text-xs">
                  {formatRoomType(currentRoom.room_type)}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  currentRoom.status === 'AVAILABLE' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {formatStatus(currentRoom.status)}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                {currentRoom.building_name || building?.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                {currentRoom.building_address || building?.address}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-300 block">{t('explorer.monthly_rent')}</span>
              <span className="text-xl sm:text-2xl font-black text-white">
                {currentRoom.base_rent.toLocaleString()} <span className="text-xs font-normal">VND</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {/* Quick Specs */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <div>
              <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" /> {t('explorer.area')}
              </span>
              <span className="text-sm font-bold text-slate-800">{currentRoom.area} m²</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-600" /> {t('explorer.capacity')}
              </span>
              <span className="text-sm font-bold text-slate-800">{currentRoom.capacity}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> {t('explorer.floor')}
              </span>
              <span className="text-sm font-bold text-slate-800">{currentRoom.floor_number}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{t('modal.room_overview')}</h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              {currentRoom.description || t('explorer.hero_desc')}
            </p>
          </div>

          {/* Amenities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('modal.amenities')}</h4>
            <div className="flex flex-wrap gap-2">
              {amenitiesList.map((a, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg text-xs font-medium flex items-center gap-1"
                >
                  <Check className="w-3 h-3 text-blue-600" />
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* Smart Meters Feature */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
            <Cpu className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-xs text-blue-900">{t('modal.smart_meters')}</h5>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">{t('modal.meter_desc')}</p>
            </div>
          </div>

          {/* Installed Equipment List */}
          {currentRoom.equipment && currentRoom.equipment.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                {t('modal.amenities')}
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {currentRoom.equipment.map(eq => (
                  <div key={eq.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">{eq.name}</span>
                      <span className="text-[11px] text-slate-500">S/N: {eq.serial_number || 'N/A'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      eq.condition === 'EXCELLENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {eq.condition}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Application Form Section */}
          <div className="pt-4 border-t border-slate-200">
            {applySuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <Check className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-bold text-emerald-900 text-base">{t('modal.apply_success')}</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  {t('modal.apply_desc')}
                </p>
              </div>
            ) : showApplyForm ? (
              <form onSubmit={handleApply} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-blue-600" />
                    {t('modal.apply_title')}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowApplyForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    {t('btn.cancel')}
                  </button>
                </div>

                {applyError && (
                  <div className="p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {applyError}
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('modal.start_date')}</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('modal.duration')}</label>
                    <select
                      value={durationMonths}
                      onChange={e => setDurationMonths(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{t('modal.occupants')}</label>
                    <input
                      type="number"
                      min={1}
                      max={currentRoom.capacity}
                      value={occupants}
                      onChange={e => setOccupants(parseInt(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('modal.notes')}</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={t('modal.notes_placeholder')}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    {submitting ? t('modal.submitting') : t('modal.submit_application')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500">{t('tenant.deposit')}</span>
                  <p className="text-sm font-bold text-slate-800">
                    1 Month ({currentRoom.base_rent.toLocaleString()} VND)
                  </p>
                </div>

                {currentRoom.status === 'AVAILABLE' ? (
                  <button
                    onClick={() => {
                      if (!user && onOpenAuthModal) {
                        onOpenAuthModal();
                      } else {
                        setShowApplyForm(true);
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {t('btn.apply_rental')}
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">
                    {formatStatus(currentRoom.status)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

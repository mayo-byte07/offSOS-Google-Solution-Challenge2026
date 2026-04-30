'use client'

import { submitReport, resolveReport } from './actions'
import { getCurrentLocation } from '@/lib/location'
import { useEffect, useState } from 'react'
import Map from '@/components/Map'
import FormScript from '@/components/FormScript'

export default function Home() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        // Auto-pruning: fetch only reports from the last 48 hours
        const fortyEightHoursAgo = new Date()
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

        const response = await fetch('/api/reports')
        const rawReports = await response.json()

        // Get user location with high precision
        // Check if we're on a secure origin (HTTPS) before using geolocation
        const isSecureOrigin = window.isSecureContext || window.location.protocol === 'https:'
        
        if (navigator.geolocation && !userLocation && isSecureOrigin) {
          setLocationLoading(true)
          console.log('Getting high-precision user location for map...')
          
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords
              console.log(`Map GPS location: Lat=${latitude}, Lng=${longitude}, Accuracy=${accuracy}m`)
              setUserLocation({ lat: latitude, lng: longitude })
              setLocationLoading(false)
            },
            (error) => {
              const errorMessage = error?.message || 'Unknown error'
              const errorCode = error?.code || 'UNKNOWN'
              console.error(`Failed to get user location for map: [${errorCode}] ${errorMessage}`)
              
              // Try with lower accuracy
              navigator.geolocation.getCurrentPosition(
                (position2) => {
                  const { latitude: lat2, longitude: lng2, accuracy: acc2 } = position2.coords
                  console.log(`Map fallback GPS: Lat=${lat2}, Lng=${lng2}, Accuracy=${acc2}m`)
                  setUserLocation({ lat: lat2, lng: lng2 })
                  setLocationLoading(false)
                },
                (error2) => {
                  const fallbackErrorMessage = error2?.message || 'Unknown error'
                  const fallbackErrorCode = error2?.code || 'UNKNOWN'
                  console.error(`Map fallback GPS also failed: [${fallbackErrorCode}] ${fallbackErrorMessage}`)
                  
                  // Try IP-based location as final fallback
                  getCurrentLocation().then(ipLocation => {
                    if (ipLocation.latitude && ipLocation.longitude) {
                      console.log(`Map IP fallback: Lat=${ipLocation.latitude}, Lng=${ipLocation.longitude}`)
                      setUserLocation({ lat: ipLocation.latitude, lng: ipLocation.longitude })
                      setLocationSource('ip')
                    }
                  }).catch(() => {
                    console.log('All location methods failed, using default location')
                  }).finally(() => {
                    setLocationLoading(false)
                  })
                },
                {
                  enableHighAccuracy: false,
                  timeout: 8000,
                  maximumAge: 60000
                }
              )
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0 // Force fresh location
            }
          )
        } else if (!userLocation) {
          // Not on secure origin, use IP-based location directly
          setLocationLoading(true)
          console.log('Not on secure origin, using IP-based location for map...')
          
          getCurrentLocation().then(ipLocation => {
            if (ipLocation.latitude && ipLocation.longitude) {
              console.log(`Map IP location: Lat=${ipLocation.latitude}, Lng=${ipLocation.longitude}`)
              setUserLocation({ lat: ipLocation.latitude, lng: ipLocation.longitude })
              setLocationSource('ip')
            }
          }).catch((error) => {
            console.error('IP location failed:', error)
          }).finally(() => {
            setLocationLoading(false)
          })
        }

        // Priority sorting (CRITICAL > URGENT > MODERATE)
        const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 }
        const reportsArray = Array.isArray(rawReports) ? rawReports : []
        const sortedReports = reportsArray.sort((a: any, b: any) => {
          const pA = priorityWeight[a.priority] || 0
          const pB = priorityWeight[b.priority] || 0
          if (pB !== pA) return pB - pA
          return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
        })

        setReports(sortedReports)
      } catch (error) {
        console.error('Failed to fetch reports:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  return (
    <main className="max-w-[90rem] mx-auto p-5 min-h-screen pb-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
      
      <div className="lg:col-span-3 lg:sticky lg:top-5 flex flex-col gap-6">
      {/* Header */}
      <header className="mb-8 text-center glass-panel rounded-[2rem] p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none" />
        <h1 className="font-heading text-5xl font-black tracking-tighter mb-2 bg-gradient-to-br from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-sm">
          offSOS
        </h1>
        <p className="text-sm font-medium text-zinc-400">Crisis reporting that works anywhere</p>
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs font-bold text-zinc-300 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-[urgent-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
          {loading ? 'Loading...' : `${reports.length} ACTIVE REPORTS`}
        </div>
      </header>

      {/* Panic Button */}
      <section className="mb-8 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
        <form action={submitReport} id="panicForm" className="relative">
          <input type="hidden" name="name" value="Anonymous (Panic)" />
          <input type="hidden" name="location" id="panicLoc" value="Locating..." />
          <input type="hidden" name="status" value="HELP" />
          <input type="hidden" name="priority" value="CRITICAL" />
          <div className="flex flex-col gap-3">
              <button 
                type="button" 
                className="w-full bg-gradient-to-b from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 text-white font-heading font-black py-7 rounded-[2rem] text-3xl tracking-widest shadow-[0_10px_40px_-10px_rgba(225,29,72,0.8)] transition-all active:scale-[0.98] animate-pulse border border-red-400/30 flex items-center justify-center gap-3"
                onClick={async () => {
                  const form = document.getElementById('panicForm') as HTMLFormElement;
                  const panicLocInput = document.getElementById('panicLoc') as HTMLInputElement;
                  
                  panicLocInput.value = 'Locating...';
                  setLocationLoading(true);
                  
                  try {
                    const locationData = await getCurrentLocation();
                    const location = locationData.address || `${locationData.latitude.toFixed(8)}, ${locationData.longitude.toFixed(8)}`;
                    
                    panicLocInput.value = location;
                    // Update user location state
                    if (locationData.latitude && locationData.longitude) {
                      setUserLocation({ lat: locationData.latitude, lng: locationData.longitude });
                      // Update location source
                      setLocationSource(locationData.source || null);
                    }
                    
                    const deviceInfo = navigator.platform + ' ' + (navigator.userAgent.match(/Android|iPhone|iPad/) ? navigator.userAgent.match(/Android|iPhone|iPad/)![0] : 'Web');
                    
                    window.location.href = `sms:112?body=${encodeURIComponent(`🚨 SOS PANIC!\nLoc: ${location}\nDevice: ${deviceInfo}`)}`;
                    
                    // Submit form normally (using action prop)
                    setTimeout(() => form.submit(), 800);
                    
                    // Refresh reports after submission
                    setTimeout(async () => {
                      const response = await fetch('/api/reports');
                      const rawReports = await response.json();
                      const reportsArray = Array.isArray(rawReports) ? rawReports : [];
                      const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 };
                      const sortedReports = reportsArray.sort((a: any, b: any) => {
                        const pA = priorityWeight[a.priority] || 0;
                        const pB = priorityWeight[b.priority] || 0;
                        if (pB !== pA) return pB - pA;
                        return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime();
                      });
                      setReports(sortedReports);
                    }, 1000);
                    
                  } catch (error) {
                    console.error('Panic location failed:', error);
                    panicLocInput.value = 'Unknown Location';
                    const deviceInfo = navigator.platform + ' ' + (navigator.userAgent.match(/Android|iPhone/)? navigator.userAgent.match(/Android|iPhone|iPad/)![0] : 'Web');
                    
                    window.location.href = `sms:112?body=${encodeURIComponent(`🚨 SOS PANIC!\nLoc: Unknown Location\nDevice: ${deviceInfo}`)}`;
                    
                    // Submit form normally (using action prop)
                    setTimeout(() => form.submit(), 800);
                    
                    // Refresh reports after submission
                    setTimeout(async () => {
                      const response = await fetch('/api/reports');
                      const rawReports = await response.json();
                      const reportsArray = Array.isArray(rawReports) ? rawReports : [];
                      const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 };
                      const sortedReports = reportsArray.sort((a: any, b: any) => {
                        const pA = priorityWeight[a.priority] || 0;
                        const pB = priorityWeight[b.priority] || 0;
                        if (pB !== pA) return pB - pA;
                        return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime();
                      });
                      setReports(sortedReports);
                    }, 1000);
                  } finally {
                    setLocationLoading(false);
                  }
                }}
              >
                <span className="text-4xl drop-shadow-lg">🚨</span> PANIC
              </button>
              <button
                type="button"
                className="w-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 font-bold py-3 rounded-2xl text-xs uppercase tracking-widest border border-white/5 transition-all active:scale-95"
                onClick={async () => {
                  const form = document.getElementById('panicForm') as HTMLFormElement;
                  const panicLocInput = document.getElementById('panicLoc') as HTMLInputElement;
                  
                  panicLocInput.value = 'Locating...';
                  
                  try {
                    const locationData = await getCurrentLocation();
                    const location = locationData.address || `${locationData.latitude.toFixed(8)}, ${locationData.longitude.toFixed(8)}`;
                    
                    panicLocInput.value = location;
                    
                    // Submit form normally (using action prop)
                    form.submit();
                    
                    // Refresh reports after submission
                    setTimeout(async () => {
                      const response = await fetch('/api/reports');
                      const rawReports = await response.json();
                      const reportsArray = Array.isArray(rawReports) ? rawReports : [];
                      const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 };
                      const sortedReports = reportsArray.sort((a: any, b: any) => {
                        const pA = priorityWeight[a.priority] || 0;
                        const pB = priorityWeight[b.priority] || 0;
                        if (pB !== pA) return pB - pA;
                        return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime();
                      });
                      setReports(sortedReports);
                    }, 1000);
                    
                  } catch (error) {
                    console.error('Silent panic location failed:', error);
                    panicLocInput.value = 'Unknown Location';
                    
                    // Submit form normally (using action prop)
                    form.submit();
                    
                    // Refresh reports after submission
                    setTimeout(async () => {
                      const response = await fetch('/api/reports');
                      const rawReports = await response.json();
                      const reportsArray = Array.isArray(rawReports) ? rawReports : [];
                      const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 };
                      const sortedReports = reportsArray.sort((a: any, b: any) => {
                        const pA = priorityWeight[a.priority] || 0;
                        const pB = priorityWeight[b.priority] || 0;
                        if (pB !== pA) return pB - pA;
                        return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime();
                      });
                      setReports(sortedReports);
                    }, 1000);
                  }
                }}
              >
                🔕 Silent Trigger (No SMS / Animation)
              </button>
            </div>
        </form>
      </section>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-5 mt-10 lg:mt-0">
      {/* Detailed Report Form */}
      <section className="glass-panel rounded-[2rem] p-6 mb-10">
        <h2 className="font-heading text-lg font-bold text-white mb-6 flex items-center gap-3">
          <span>Detailed Report</span>
          <div className="h-px bg-white/10 flex-1" />
        </h2>
        
        <form 
          action={async (formData: FormData) => {
            try {
              await submitReport(formData);
              // Immediately refresh reports after submission
              const response = await fetch('/api/reports');
              const rawReports = await response.json();
              const reportsArray = Array.isArray(rawReports) ? rawReports : [];
              
              // Priority sorting (CRITICAL > URGENT > MODERATE)
              const priorityWeight: Record<string, number> = { 'CRITICAL': 3, 'URGENT': 2, 'MODERATE': 1 };
              const sortedReports = reportsArray.sort((a: any, b: any) => {
                const pA = priorityWeight[a.priority] || 0;
                const pB = priorityWeight[b.priority] || 0;
                if (pB !== pA) return pB - pA;
                return new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime();
              });
              
              setReports(sortedReports);
              
              // Show success message
              alert('SOS Report broadcasted successfully!');
            } catch (error) {
              console.error('Failed to submit report:', error);
              alert('Failed to submit report. Please try again.');
            }
          }}
          className="flex flex-col gap-6"
        >
          <input type="hidden" name="status" value="HELP" />

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">Name</label>
            <input
              name="name"
              required
              type="text"
              className="w-full glass-input rounded-2xl p-4 text-white focus:outline-none placeholder:text-zinc-600 font-medium"
              placeholder="Your name or family name"
            />
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Location</label>
              <button
                type="button"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 px-3 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer border border-emerald-400/20 bg-emerald-400/5 shadow-inner"
                onClick={async () => {
                  const locationInput = document.getElementById('loc') as HTMLInputElement;
                  locationInput.value = 'Locating...';
                  setLocationLoading(true);
                  
                  try {
                    const locationData = await getCurrentLocation();
                    if (locationData.error) {
                      locationInput.value = locationData.address || 'Location unavailable';
                    } else {
                      locationInput.value = locationData.address || `${locationData.latitude.toFixed(8)}, ${locationData.longitude.toFixed(8)}`;
                      // Update user location state
                      setUserLocation({ lat: locationData.latitude, lng: locationData.longitude });
                      // Update location source
                      setLocationSource(locationData.source || null);
                    }
                  } catch (error) {
                    console.error('Location fetch failed:', error);
                    locationInput.value = 'Location unavailable';
                  } finally {
                    setLocationLoading(false);
                  }
                }}
              >
                📍 AUTO GPS
              </button>
            </div>
            <input
              id="loc"
              name="location"
              required
              type="text"
              className="w-full glass-input rounded-2xl p-4 text-white focus:outline-none placeholder:text-zinc-600 font-medium"
              placeholder="e.g. GPS, 'near temple', 'beside highway'"
            />
            {locationSource === 'ip' && (
              <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  ⚠️ Using estimated location. For precise GPS, ensure HTTPS and allow permissions.
                </p>
              </div>
            )}
            <label className="flex items-center gap-3 mt-3 text-sm text-zinc-400 cursor-pointer w-full p-3 bg-black/20 rounded-xl border border-transparent hover:border-white/5 transition-colors">
              <input type="checkbox" name="isPrivate" className="w-5 h-5 rounded-md bg-black/50 border-white/20 text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-colors cursor-pointer" />
              Hide exact location from feed
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <label className="relative flex cursor-pointer rounded-2xl border border-white/5 bg-black/30 p-5 focus-within:ring-2 focus-within:ring-white/50 focus-within:border-white/50 hover:bg-white/5 transition-all group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="radio" name="priority" value="MODERATE" className="sr-only" defaultChecked />
              <span className="relative flex flex-col items-center justify-center w-full gap-3 transition-transform group-active:scale-95">
                <span className="text-3xl drop-shadow-md">🟡</span>
                <span className="font-heading font-bold text-xs tracking-widest text-zinc-300">MODERATE</span>
              </span>
            </label>

            <label className="relative flex cursor-pointer rounded-2xl border border-white/5 bg-black/30 p-5 focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-500/50 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="radio" name="priority" value="CRITICAL" className="sr-only" />
              <span className="relative flex flex-col items-center justify-center w-full gap-3 transition-transform group-active:scale-95">
                <span className="text-3xl drop-shadow-md group-hover:animate-pulse">🚨</span>
                <span className="font-heading font-bold text-xs tracking-widest text-rose-400">CRITICAL</span>
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">Category</label>
            <div className="relative">
              <select
                name="category"
                className="w-full glass-input rounded-2xl p-4 text-white focus:outline-none appearance-none font-medium pr-10"
              >
                <option value="">Select an emergency type...</option>
                <option value="MEDICAL">🩺 Medical Emergency</option>
                <option value="FIRE">🔥 Fire Hazard</option>
                <option value="TRAPPED">🧱 Trapped / Immobolized</option>
                <option value="RESOURCES">💧 Need Food / Water</option>
                <option value="SECURITY">⚠️ Security Threat</option>
                <option value="FLOOD">🌊 Flood / High Water</option>
                <option value="INFRA_ROAD">🚧 Blocked Road</option>
                <option value="INFRA_BRIDGE">🌉 Collapsed Bridge</option>
                <option value="INFRA_POWER">⚡ Power / Comm Failure</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-zinc-500">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">Additional Details</label>
            <input
              name="message"
              type="text"
              className="w-full glass-input rounded-2xl p-4 text-white focus:outline-none placeholder:text-zinc-600 font-medium"
              placeholder="e.g. Water is rising fast, trapped on roof"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="flex-1 bg-white text-black font-heading font-black py-4 rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all text-lg shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              BROADCAST SOS
            </button>
            <div dangerouslySetInnerHTML={{
              __html: `<button type="button" class="flex items-center justify-center bg-zinc-800 text-white px-6 py-4 rounded-2xl font-bold hover:bg-zinc-700 active:scale-95 transition-all border border-zinc-700 hover:border-zinc-600 shadow-lg" onclick="const f=this.closest('form');const loc=f.location.value||'Unknown';const cat=f.category.value;const msg=f.message.value;window.location.href='sms:112?body='+encodeURIComponent('OFFLINE SOS!%0ALoc: '+loc+'%0ACat: '+cat+'%0ADetails: '+msg);"><span class="text-xl mr-2">💬</span> SMS</button>`
            }} />
          </div>

        </form>
      </section>
      </div>

      <div className="lg:col-span-4 mt-10 lg:mt-0">
      {/* Map View */}
      <section className="mb-6">
        <h2 className="font-heading text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center justify-between px-2">
          <span className="flex items-center gap-2">Map View <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /></span>
          <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full font-mono border border-white/5">Live Locations</span>
        </h2>
        <div className="glass-panel rounded-[2rem] p-4">
          <Map reports={reports} userLocation={userLocation} />
        </div>
      </section>

      {/* Live Feed */}
      <section className="h-full">
        <h2 className="font-heading text-xs font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center justify-between px-2">
          <span className="flex items-center gap-2">Live Feed <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" /></span>
          <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full font-mono border border-white/5">Last 48h</span>
        </h2>

        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="text-center p-10 text-zinc-500 text-sm border border-dashed border-white/10 rounded-3xl bg-white/5">
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center p-10 text-zinc-500 text-sm border border-dashed border-white/10 rounded-3xl bg-white/5">
              No active reports in your area.
            </div>
          ) : (
            reports.map((report: any) => {
              const isHelp = report.status === 'HELP'
              const isHidden = report.location.startsWith('[HIDDEN]')
              const rawLocation = report.location.replace('[HIDDEN]', '').trim()
              let displayLocation = rawLocation
              if (isHidden) {
                const parts = rawLocation.split(',')
                if (parts.length > 1 && isNaN(parseFloat(parts[parts.length-1]))) {
                  displayLocation = 'Near ' + parts[parts.length - 1].trim()
                } else if (parts.length > 1) {
                  const lat = parseFloat(parts[0]).toFixed(1)
                  const lon = parseFloat(parts[1]).toFixed(1)
                  displayLocation = `Approx (${lat}, ${lon})`
                } else {
                  displayLocation = 'Approximate Location'
                }
              }

              const getMessageIcon = (category: string | null, priority: string) => {
                let icon = '';
                if (category === 'MEDICAL') icon = '🩺 Medical';
                else if (category === 'FIRE') icon = '🔥 Fire';
                else if (category === 'TRAPPED') icon = '🧱 Trapped';
                else if (category === 'RESOURCES') icon = '💧 Resources';
                else if (category === 'SECURITY') icon = '⚠️ Security';
                else if (category === 'FLOOD') icon = '🌊 Flood';
                else if (category === 'INFRA_ROAD') icon = '🚧 Blocked Road';
                else if (category === 'INFRA_BRIDGE') icon = '🌉 Collapsed Bridge';
                else if (category === 'INFRA_POWER') icon = '⚡ Power Failure';
                else icon = category || '';
                
                const priorityBadge = priority === 'CRITICAL' ? ' 🚨 CRITICAL' : '';
                return icon + priorityBadge;
              }

              return (
                <div
                  key={report.id}
                  className={`relative overflow-hidden rounded-3xl glass-panel p-5 transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 ${isHelp
                      ? 'border-l-[6px] border-l-rose-500/80 shadow-[0_4px_20px_rgba(244,63,94,0.1)]'
                      : 'border-l-[6px] border-l-emerald-500/50'
                    }`}
                >
                  <div className="absolute -top-4 -right-4 p-4 opacity-5 pointer-events-none text-8xl mix-blend-overlay">
                    {isHelp ? '🚨' : '🟢'}
                  </div>
                  
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <h3 className="font-heading font-bold text-white flex items-center gap-2 text-xl">
                      {report.name}
                    </h3>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[11px] text-zinc-400 font-mono bg-black/40 px-2.5 py-1 rounded-md border border-white/5 shadow-inner">
                        {Math.max(0, Math.floor((Date.now() - new Date(report.created_at || report.createdAt).getTime()) / 60000))}m ago
                      </span>
                      {isHelp && (
                        <form action={resolveReport.bind(null, report.id)}>
                          <button type="submit" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all shadow-sm active:scale-95">
                            ✓ Help Received
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="text-sm text-zinc-300 font-medium mb-1 relative z-10 flex items-center gap-2">
                    <span className="opacity-50">📍</span> {displayLocation}
                  </div>

                  {(report.category || report.priority === 'CRITICAL') && (
                    <div className={`mt-4 inline-flex items-center gap-2 bg-black/50 border ${report.priority === 'CRITICAL' ? 'border-rose-500/30 text-rose-400' : 'border-white/10 text-zinc-300'} text-xs px-3 py-1.5 rounded-lg font-bold shadow-inner relative z-10`}>
                      {getMessageIcon(report.category, report.priority)}
                    </div>
                  )}

                  {report.message && (
                    <div className="mt-3 text-sm text-zinc-400 italic border-l-2 border-white/10 pl-3 py-1 relative z-10 bg-black/20 rounded-r-lg">
                      "{report.message}"
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>
      </div>

      <FormScript />
    </main>
  )
}

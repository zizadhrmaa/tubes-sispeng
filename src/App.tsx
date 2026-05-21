import { useEffect, useMemo, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from './firebase'
import './index.css'

/* ─────────────────────────────── TYPES ─── */
interface KwhData {
  voltage: number; current: number; power: number
  energy: number; frequency: number; pf: number
  connected: boolean; timestamp: string
}
interface CableData {
  resistansi: number; lokasi: number; tegangan: number
  arus_potensial: number; arus_galvanometer: number
  connected: boolean; timestamp: string
}
interface HistoryPoint { time: string; voltage: number; current: number; power: number }
interface OscilloData {
  connected: boolean; timestamp: string
  modeTampilan: number; tampilInfo: boolean
  tipeSinyalCH1: number; tipeSinyalCH2: number
  dataCH1: number[]; dataCH2: number[]
  ch1: { vpp: number; freq: number; vdc: number; vmax: number; vmin: number }
  ch2: { vpp: number; freq: number; vdc: number; vmax: number; vmin: number }
  sampleTimeUs: number
}
interface Member { name: string; nim: string; role: string; photo: string }
type ActiveView = 'kwh' | 'cable' | 'oscillo' | 'about'

/* ─────────────────────────────── CONSTANTS ─── */
const EMPTY_KWH: KwhData = { voltage:0, current:0, power:0, energy:0, frequency:0, pf:0, connected:false, timestamp:'-' }
const EMPTY_CABLE: CableData = { resistansi:0, lokasi:0, tegangan:0, arus_potensial:0, arus_galvanometer:0, connected:false, timestamp:'-' }
const EMPTY_OSCILLO: OscilloData = {
  connected:false, timestamp:'-', modeTampilan:0, tampilInfo:false,
  tipeSinyalCH1:0, tipeSinyalCH2:0, dataCH1:[], dataCH2:[],
  ch1:{vpp:0,freq:0,vdc:0,vmax:0,vmin:0}, ch2:{vpp:0,freq:0,vdc:0,vmax:0,vmin:0},
  sampleTimeUs:0,
}

const TEAM: Member[] = [
  { name:'Aziza Dharma Putri',     nim:'13524017', role:'Perancangan & pengembangan website monitoring.',         photo:'/team/aziza.jpg' },
  { name:'Muchammad Asshiddiqi',  nim:'18024016', role:'Penyusunan laporan dan dokumentasi proyek.',            photo:'/team/diqi.jpg'  },
  { name:'Rasyid Abdurrahman',    nim:'18024056', role:'Pembuatan rangkaian alat (hardware).',                  photo:'/team/ocid.jpg'  },
  { name:'Nathanael Pramanugraha',nim:'18024048', role:'Pembuatan video dokumentasi dan presentasi.',           photo:'/team/nael.jpg'  },
  { name:'Aldito Zahran Habibi',  nim:'18024006', role:'Pembuatan poster & pengadaan bahan perakitan.',         photo:'/team/aldito.jpg'},
  { name:'Khairul Arief Rahman',  nim:'18024008', role:'Pembuatan rangkaian alat (hardware) & integrasi sistem.',photo:'/team/khairul.jpg'},
]

const TARIF = 1444.7
const fmt = (v: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v)

/* ─────────────────────────────── SHARED COMPONENTS ─── */

const Sparkline = ({ data, field }: { data: HistoryPoint[]; field: keyof Omit<HistoryPoint,'time'> }) => {
  if (data.length < 2) return <div className="spark-wrap"><div className="spark-empty">Menunggu data…</div></div>
  const vals = data.map(d => d[field] as number)
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const W = 400, H = 48
  const pts = vals.map((v,i) => `${(i/(vals.length-1))*W},${H-((v-lo)/span)*H}`).join(' ')
  return (
    <div className="spark-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="spark-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sg-${field}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#bfdbfe"/>
            <stop offset="100%" stopColor="#2563eb"/>
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke={`url(#sg-${field})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

const MetricCard = ({ label, value, unit, field, desc, history, prog }: {
  label: string; value: number; unit: string; field: keyof Omit<HistoryPoint,'time'>
  desc: string; history: HistoryPoint[]; prog: number
}) => (
  <div className="card metric-card">
    <div className="metric-header">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-val-wrap">
          <span className="metric-val">{value.toFixed(field==='current'?3:1)}</span>
          <span className="metric-unit">{unit}</span>
        </div>
      </div>
      <div className="metric-badge">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
    </div>
    <div className="prog-track"><div className="prog-fill" style={{width:`${prog}%`}}/></div>
    <Sparkline data={history} field={field}/>
    <div className="metric-note">{desc}</div>
  </div>
)

const CableMetricCard = ({ label, value, unit, desc }: {
  label: string; value: number; unit: string; desc: string
}) => (
  <div className="card metric-card">
    <div className="metric-header">
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-val-wrap">
          <span className="metric-val">{value.toFixed(2)}</span>
          <span className="metric-unit">{unit}</span>
        </div>
      </div>
    </div>
    <div className="metric-note" style={{marginTop:'auto'}}>{desc}</div>
  </div>
)

const Modal = ({ deviceId, setDeviceId, onClose, onSave }: {
  deviceId: string; setDeviceId:(v:string)=>void; onClose:()=>void; onSave:()=>void
}) => (
  <div className="modal-backdrop">
    <div className="modal-scrim" onClick={onClose}/>
    <div className="modal-box">
      <div className="modal-title">Ubah Device ID</div>
      <div className="modal-sub">Masukkan device ID yang sama dengan path di Firebase Realtime Database.</div>
      <div className="field">
        <label>Device ID</label>
        <input value={deviceId} onChange={e=>setDeviceId(e.target.value)} placeholder="contoh: rumah01"/>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" onClick={onSave}>Simpan</button>
      </div>
    </div>
  </div>
)

/* ─────────────────────────────── KWH DASHBOARD ─── */
type KwhTab = 'dashboard' | 'history'

const KwhMeter = () => {
  const [deviceId,setDeviceId] = useState('rumah01')
  const [temp,setTemp] = useState('rumah01')
  const [data,setData] = useState<KwhData>(EMPTY_KWH)
  const [history,setHistory] = useState<HistoryPoint[]>([])
  const [showModal,setShowModal] = useState(false)
  const [error,setError] = useState('')
  const [tab,setTab] = useState<KwhTab>('dashboard')

  useEffect(()=>{
    const r = ref(db,`meters/${deviceId}/latest`)
    return onValue(r, snap=>{
      const j = snap.val()
      if(!j){ setData(p=>({...p,connected:false})); setError('Data belum ada di Firebase.'); return }
      const t = new Date().toLocaleTimeString('id-ID')
      const next: KwhData = {
        voltage:Number(j.voltage??0), current:Number(j.current??0), power:Number(j.power??0),
        energy:Number(j.energy??0), frequency:Number(j.frequency??0), pf:Number(j.pf??0),
        connected:Boolean(j.connected), timestamp:t,
      }
      setData(next)
      setHistory(p=>[...p.slice(-23),{time:t,voltage:next.voltage,current:next.current,power:next.power}])
      setError('')
    }, ()=>{ setData(p=>({...p,connected:false})); setError('Gagal terhubung ke Firebase.') })
  },[deviceId])

  const cost = data.energy * TARIF
  const vProg = useMemo(()=>Math.min((data.voltage/250)*100,100),[data.voltage])
  const iProg = useMemo(()=>Math.min((data.current/10)*100,100),[data.current])
  const pProg = useMemo(()=>Math.min((data.power/2200)*100,100),[data.power])

  return (
    <>
      <div className="card project-hero">
        <div>
          <div className="hero-eyebrow">
            <span className="hero-tag">EP2004 · KWH Meter</span>
          </div>
          <div className="hero-title">Monitoring Energi Listrik</div>
          <div className="hero-desc">
            Dashboard real-time berbasis ESP32 + PZEM004T. Pantau tegangan, arus, daya, dan estimasi biaya langsung dari Firebase.
          </div>
        </div>
        <div className="hero-right">
          <div className={`status-pill ${data.connected?'online':'offline'}`}>
            <div className="status-dot"/>
            {data.connected?'Realtime aktif':'Device offline'}
          </div>
          <button className="btn btn-primary" onClick={()=>{setTemp(deviceId);setShowModal(true)}}>
            Ubah Device ID
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-item"><div className="summary-label">Device</div><div className="summary-value">{deviceId}</div></div>
        <div className="summary-item"><div className="summary-label">Update terakhir</div><div className="summary-value">{data.timestamp}</div></div>
        <div className="summary-item"><div className="summary-label">Estimasi biaya</div><div className="summary-value">{fmt(cost)}</div></div>
        <div className="summary-item"><div className="summary-label">Power factor</div><div className="summary-value">{data.pf.toFixed(2)}</div></div>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="tab-bar">
          <button className={`tab-item ${tab==='dashboard'?'active':''}`} onClick={()=>setTab('dashboard')}>Dashboard</button>
          <button className={`tab-item ${tab==='history'?'active':''}`} onClick={()=>setTab('history')}>Riwayat</button>
        </div>

        {tab==='dashboard' ? (
          <div style={{padding:'20px'}}>
            <div className="metrics-grid" style={{marginBottom:'12px'}}>
              <MetricCard label="Tegangan" value={data.voltage} unit="V" field="voltage" prog={vProg}
                desc="Rentang aman 210–230 V." history={history}/>
              <MetricCard label="Arus" value={data.current} unit="A" field="current" prog={iProg}
                desc="Naik seiring bertambahnya beban." history={history}/>
              <MetricCard label="Daya" value={data.power} unit="W" field="power" prog={pProg}
                desc="Total konsumsi daya saat ini." history={history}/>
            </div>
            <div className="detail-grid">
              <div className="card detail-card">
                <div className="detail-label">Energi total</div>
                <div className="detail-val">{data.energy.toFixed(3)} kWh</div>
                <div className="detail-note">Akumulasi energi yang terbaca sistem.</div>
              </div>
              <div className="card detail-card">
                <div className="detail-label">Frekuensi</div>
                <div className="detail-val">{data.frequency.toFixed(1)} Hz</div>
                <div className="detail-note">Kestabilan sumber listrik yang masuk.</div>
              </div>
              <div className="card detail-card">
                <div className="detail-label">Power factor</div>
                <div className="detail-val">{data.pf.toFixed(2)}</div>
                <div className="detail-note">Mendekati 1 = semakin efisien.</div>
              </div>
              <div className="card detail-card accent-card">
                <div className="detail-label">Estimasi biaya</div>
                <div className="detail-val">{fmt(cost)}</div>
                <div className="detail-note">Tarif Rp 1.444,7/kWh.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="history-wrap">
            <div className="history-head">
              <div>
                <div className="history-head-title">Riwayat Pembacaan</div>
                <div className="history-head-sub">{history.length} data terakhir tercatat</div>
              </div>
              <span className="history-chip">Realtime</span>
            </div>
            {history.length===0 ? (
              <div className="empty-state">Belum ada data yang masuk.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th>No</th><th>Waktu</th><th>Tegangan</th><th>Arus</th><th>Daya</th></tr></thead>
                  <tbody>
                    {[...history].reverse().map((h,i)=>(
                      <tr key={`${h.time}-${i}`}>
                        <td>{history.length-i}</td>
                        <td>{h.time}</td>
                        <td>{h.voltage.toFixed(1)} V</td>
                        <td>{h.current.toFixed(3)} A</td>
                        <td>{h.power.toFixed(1)} W</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="foot-note">
        <div>Firebase path: <span>meters/{deviceId}/latest</span></div>
        <div>{error || 'Semua data masuk normal.'}</div>
      </div>

      {showModal && <Modal deviceId={temp} setDeviceId={setTemp} onClose={()=>setShowModal(false)}
        onSave={()=>{setDeviceId(temp.trim()||'rumah01');setHistory([]);setShowModal(false)}}/>}
    </>
  )
}

/* ─────────────────────────────── CABLE FAULT DASHBOARD ─── */
const CableFault = () => {
  const [deviceId,setDeviceId] = useState('lab01')
  const [temp,setTemp] = useState('lab01')
  const [data,setData] = useState<CableData>(EMPTY_CABLE)
  const [showModal,setShowModal] = useState(false)
  const [error,setError] = useState('')

  useEffect(()=>{
    const r = ref(db,`cable-fault/${deviceId}/latest`)
    return onValue(r, snap=>{
      const j = snap.val()
      if(!j){ setData(p=>({...p,connected:false})); setError('Data cable fault belum ada.'); return }
      setData({
        resistansi:Number(j.resistansi??0), lokasi:Number(j.lokasi??0),
        tegangan:Number(j.tegangan??0), arus_potensial:Number(j.arus_potensial??0),
        arus_galvanometer:Number(j.arus_galvanometer??0), connected:Boolean(j.connected),
        timestamp: new Date().toLocaleTimeString('id-ID'),
      })
      setError('')
    }, ()=>{ setData(p=>({...p,connected:false})); setError('Gagal terhubung ke Firebase.') })
  },[deviceId])

  const markerPct = Math.min(Math.max((data.lokasi/5)*100,0),100)

  return (
    <>
      <div className="card project-hero">
        <div>
          <div className="hero-eyebrow"><span className="hero-tag">EP2004 · Cable Fault Detector</span></div>
          <div className="hero-title">Deteksi Lokasi Kerusakan Kabel</div>
          <div className="hero-desc">
            Implementasi Murray Loop Test dengan ESP32, INA219, dan ADS1115. Lokasi gangguan dihitung dari hasil pengukuran jembatan Wheatstone.
          </div>
        </div>
        <div className="hero-right">
          <div className={`status-pill ${data.connected?'online':'offline'}`}>
            <div className="status-dot"/>
            {data.connected?'Realtime aktif':'Device offline'}
          </div>
          <button className="btn btn-primary" onClick={()=>{setTemp(deviceId);setShowModal(true)}}>
            Ubah Device ID
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-item"><div className="summary-label">Device</div><div className="summary-value">{deviceId}</div></div>
        <div className="summary-item"><div className="summary-label">Update terakhir</div><div className="summary-value">{data.timestamp}</div></div>
        <div className="summary-item"><div className="summary-label">Lokasi gangguan</div><div className="summary-value">{data.lokasi.toFixed(2)} m</div></div>
        <div className="summary-item"><div className="summary-label">Resistansi potensio</div><div className="summary-value">{data.resistansi.toFixed(2)} Ω</div></div>
      </div>

      {/* fault location highlight */}
      <div className="card fault-highlight">
        <div>
          <div className="fault-hl-label">Lokasi kerusakan terdeteksi</div>
          <div className="fault-hl-val">
            {data.lokasi.toFixed(2)}
            <span className="fault-hl-unit">meter</span>
          </div>
          <div className="fault-hl-sub">
            Hasil kalkulasi Murray Loop Test. Pastikan probe sudah tersambung ke titik fault sebelum mengunci nilai.
          </div>
        </div>
        <div className="fault-cable-viz">
          <div className="fault-cable-label">Posisi gangguan pada kabel (0–5 m)</div>
          <div className="fault-track">
            <div className="fault-marker" style={{left:`${markerPct}%`}}/>
          </div>
          <div className="fault-track-labels"><span>0 m</span><span>2.5 m</span><span>5 m</span></div>
        </div>
      </div>

      <div className="cable-grid">
        <CableMetricCard label="Resistansi Potensio" value={data.resistansi} unit="Ω"
          desc="Nilai resistansi yang diukur untuk menyeimbangkan jembatan Wheatstone."/>
        <CableMetricCard label="Tegangan" value={data.tegangan} unit="V"
          desc="Tegangan yang terdeteksi pada rangkaian Murray Loop."/>
        <CableMetricCard label="Arus Potensial" value={data.arus_potensial} unit="mA"
          desc="Arus yang mengalir melalui jalur potensial pengukuran."/>
        <CableMetricCard label="Arus Galvanometer" value={data.arus_galvanometer} unit="mA"
          desc="Idealnya mendekati 0 mA saat jembatan Wheatstone setimbang."/>
      </div>

      <div className="card info-card">
        <div className="info-title">Prinsip Murray Loop Test</div>
        <div className="info-body">
          Murray Loop Test adalah metode klasik untuk mendeteksi lokasi gangguan pada kabel bawah tanah. Kedua ujung kabel yang tidak rusak disambungkan membentuk loop, lalu arus dialirkan. Dengan prinsip jembatan Wheatstone, resistansi diukur dan lokasi gangguan dihitung:
        </div>
        <div className="code-block">
          x = (L_loop / 2) + (ΔV / (I × R_m)) + offset_kalibrasi
        </div>
        <div className="info-body" style={{marginTop:'12px',marginBottom:0,fontSize:'12px'}}>
          <strong>x</strong> = lokasi gangguan (m) &nbsp;·&nbsp; <strong>L_loop</strong> = total lintasan loop (m) &nbsp;·&nbsp; <strong>ΔV</strong> = beda tegangan &nbsp;·&nbsp; <strong>I</strong> = arus &nbsp;·&nbsp; <strong>R_m</strong> = resistansi referensi
        </div>
      </div>

      <div className="foot-note">
        <div>Firebase path: <span>cable-fault/{deviceId}/latest</span></div>
        <div>{error || 'Data cable fault masuk normal.'}</div>
      </div>

      {showModal && <Modal deviceId={temp} setDeviceId={setTemp} onClose={()=>setShowModal(false)}
        onSave={()=>{setDeviceId(temp.trim()||'lab01');setShowModal(false)}}/>}
    </>
  )
}

/* ─────────────────────────────── OSCILLO DASHBOARD ─── */
const SIGNAL_LABELS = ['SIN','DC','SQR','TRI']
const MODE_LABELS = ['Dual · fokus CH1','Dual · fokus CH2','Full CH1','Full CH2','Overlay · fokus CH1','Overlay · fokus CH2']

const asNumberArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(v => Number(v ?? 0)).filter(Number.isFinite)
  }

  // Firebase Realtime Database kadang mengembalikan array sebagai object:
  // { "0": 2048, "1": 2148, ... }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((a,b) => Number(a) - Number(b))
      .map(k => Number((value as Record<string, unknown>)[k] ?? 0))
      .filter(Number.isFinite)
  }

  // Cadangan kalau data pernah tersimpan sebagai string "2048,2148,..."
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(v => Number(v.trim()))
      .filter(Number.isFinite)
  }

  return []
}

const voltsFromAdc = (adc: number) => (adc / 4095) * 3.3
const readMetric = (obj: any, keys: string[], fallback = 0) => {
  for (const k of keys) {
    const n = Number(obj?.[k])
    if (Number.isFinite(n)) return n
  }
  return fallback
}

const firstFiniteNumber = (...values: unknown[]) => {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return 0
}

const calcChannelStats = (samples: number[], signalType: number, sampleTimeUs: number) => {
  if (!samples.length) return {vpp:0, freq:0, vdc:0, vmax:0, vmin:0}
  const maxADC = Math.max(...samples)
  const minADC = Math.min(...samples)
  const avgADC = samples.reduce((a,b)=>a+b,0) / samples.length
  const vmax = voltsFromAdc(maxADC)
  const vmin = voltsFromAdc(minADC)
  const vpp = vmax - vmin
  const vdc = voltsFromAdc(avgADC)
  let crossing = 0
  for (let i=1; i<samples.length; i++) {
    if (samples[i-1] < avgADC && samples[i] >= avgADC) crossing++
  }
  const totalSeconds = sampleTimeUs > 0 ? sampleTimeUs / 1_000_000 : 0
  const freq = signalType !== 1 && vpp > 0.1 && totalSeconds > 0 ? crossing / totalSeconds : 0
  return {vpp, freq, vdc, vmax, vmin}
}

const Waveform = ({ ch1, ch2, mode }: { ch1: number[]; ch2: number[]; mode: number }) => {
  const W = 640, H = 220
  const normalize = (arr: number[], top: number, bottom: number) => {
    const safe = arr.length ? arr : [0]
    const step = W / Math.max(safe.length - 1, 1)
    return safe.map((v,i)=>`${i*step},${bottom - (Math.min(Math.max(v,0),4095) / 4095) * (bottom-top)}`).join(' ')
  }
  const dual = mode === 0 || mode === 1
  const showCH1 = mode !== 3
  const showCH2 = mode !== 2
  return (
    <div className="card wave-card">
      <div className="wave-head">
        <div>
          <div className="info-title">Waveform ADC Real-time</div>
          <div className="wave-sub">Grafik mengikuti array <span>dataCH1</span> dan <span>dataCH2</span> dari ESP32.</div>
        </div>
        <div className="wave-legend"><span className="legend-ch1"/>CH1 <span className="legend-ch2"/>CH2</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="wave-svg" preserveAspectRatio="none">
        {[0,1,2,3,4].map(i=><line key={`h${i}`} x1="0" x2={W} y1={(H/4)*i} y2={(H/4)*i} className="grid-line"/>)}
        {[0,1,2,3,4,5,6,7,8].map(i=><line key={`v${i}`} y1="0" y2={H} x1={(W/8)*i} x2={(W/8)*i} className="grid-line"/>)}
        {dual && <line x1="0" x2={W} y1={H/2} y2={H/2} className="mid-line"/>}
        {showCH1 && <polyline points={normalize(ch1, dual ? 8 : 8, dual ? H/2-8 : H-8)} className="wave-line ch1"/>}
        {showCH2 && <polyline points={normalize(ch2, dual ? H/2+8 : 8, dual ? H-8 : H-8)} className="wave-line ch2"/>}
      </svg>
    </div>
  )
}

const Oscillo = () => {
  const [deviceId,setDeviceId] = useState('lab01')
  const [temp,setTemp] = useState('lab01')
  const [data,setData] = useState<OscilloData>(EMPTY_OSCILLO)
  const [showModal,setShowModal] = useState(false)
  const [error,setError] = useState('')

  useEffect(()=>{
    const r = ref(db,`oscilloscope/${deviceId}/latest`)
    return onValue(r, snap=>{
      const j = snap.val()

      if(!j){
        setData(p=>({...p,connected:false,timestamp:'-',dataCH1:[],dataCH2:[]}))
        setError('Data osiloskop belum ada di Firebase. Pastikan JSON di-import ke oscilloscope/lab01/latest.')
        return
      }

      // Format utama yang sesuai kode ESP:
      // dataCH1, dataCH2, tipeSinyalCH1, tipeSinyalCH2, modeTampilan, tampilInfo, sampleTimeUs.
      // Fallback tetap disediakan supaya data dummy lama / struktur alternatif masih kebaca.
      const rawCH1 = asNumberArray(j.dataCH1 ?? j.waveform?.ch1 ?? j.ch1?.samples ?? j.samplesCH1)
      const rawCH2 = asNumberArray(j.dataCH2 ?? j.waveform?.ch2 ?? j.ch2?.samples ?? j.samplesCH2)

      const tipeSinyalCH1 = firstFiniteNumber(j.tipeSinyalCH1, j.ch1?.tipeSinyal, j.ch1?.signalType)
      const tipeSinyalCH2 = firstFiniteNumber(j.tipeSinyalCH2, j.ch2?.tipeSinyal, j.ch2?.signalType)
      const modeTampilan = firstFiniteNumber(j.modeTampilan, j.mode)
      const sampleTimeUs = firstFiniteNumber(j.sampleTimeUs, j.waktuSamplingUs, j.captureTimeUs, rawCH1.length * 50, 128 * 50)

      // Website menghitung Vpp, Vdc/Vavg, Vmax, Vmin, dan frekuensi dari array ADC,
      // sama seperti logika kode ESP. Field ch1/ch2 dari Firebase hanya opsional.
      const calcCH1 = calcChannelStats(rawCH1, tipeSinyalCH1, sampleTimeUs)
      const calcCH2 = calcChannelStats(rawCH2, tipeSinyalCH2, sampleTimeUs)

      const next: OscilloData = {
        connected: Boolean(j.connected ?? true),
        timestamp: String(j.timestamp ?? new Date().toLocaleTimeString('id-ID')),
        modeTampilan,
        tampilInfo: Boolean(j.tampilInfo ?? false),
        tipeSinyalCH1,
        tipeSinyalCH2,
        dataCH1: rawCH1,
        dataCH2: rawCH2,
        sampleTimeUs,
        ch1: {
          vpp: readMetric(j.ch1, ['vpp','Vpp'], calcCH1.vpp),
          freq: readMetric(j.ch1, ['freq','frequency','frekuensi'], calcCH1.freq),
          vdc: readMetric(j.ch1, ['vdc','Vdc','vAvg','vavg'], calcCH1.vdc),
          vmax: readMetric(j.ch1, ['vmax','vMax'], calcCH1.vmax),
          vmin: readMetric(j.ch1, ['vmin','vMin'], calcCH1.vmin),
        },
        ch2: {
          vpp: readMetric(j.ch2, ['vpp','Vpp'], calcCH2.vpp),
          freq: readMetric(j.ch2, ['freq','frequency','frekuensi'], calcCH2.freq),
          vdc: readMetric(j.ch2, ['vdc','Vdc','vAvg','vavg'], calcCH2.vdc),
          vmax: readMetric(j.ch2, ['vmax','vMax'], calcCH2.vmax),
          vmin: readMetric(j.ch2, ['vmin','vMin'], calcCH2.vmin),
        },
      }

      setData(next)

      if (!rawCH1.length && !rawCH2.length) {
        setError('Firebase sudah terbaca, tapi dataCH1/dataCH2 masih kosong.')
      } else {
        setError('')
      }
    }, ()=>{
      setData(p=>({...p,connected:false}))
      setError('Gagal terhubung ke Firebase.')
    })
  },[deviceId])

  const activeCH = data.modeTampilan === 0 || data.modeTampilan === 2 || data.modeTampilan === 4 ? 'CH1' : 'CH2'
  const activeSignal = activeCH === 'CH1' ? data.tipeSinyalCH1 : data.tipeSinyalCH2
  const activeMetric = activeCH === 'CH1' ? data.ch1 : data.ch2

  return (
    <>
      <div className="card project-hero">
        <div>
          <div className="hero-eyebrow"><span className="hero-tag">EP2004 · Osiloskop</span></div>
          <div className="hero-title">SmartScope — Monitoring Sinyal ESP32</div>
          <div className="hero-desc">
            Tampilan web ini disesuaikan dengan kode ESP: dua channel ADC, mode SIN/DC/SQR/TRI, mode layar Dual/Full/Overlay, serta OSD Vpp, frekuensi, dan Vdc.
          </div>
        </div>
        <div className="hero-right">
          <div className={`status-pill ${data.connected?'online':'offline'}`}><div className="status-dot"/>{data.connected?'Realtime aktif':'Device offline'}</div>
          <button className="btn btn-primary" onClick={()=>{setTemp(deviceId);setShowModal(true)}}>Ubah Device ID</button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-item"><div className="summary-label">Device</div><div className="summary-value">{deviceId}</div></div>
        <div className="summary-item"><div className="summary-label">Update terakhir</div><div className="summary-value">{data.timestamp}</div></div>
        <div className="summary-item"><div className="summary-label">Mode tampilan</div><div className="summary-value">{MODE_LABELS[data.modeTampilan] ?? `Mode ${data.modeTampilan}`}</div></div>
        <div className="summary-item"><div className="summary-label">Channel fokus</div><div className="summary-value">{activeCH} · {SIGNAL_LABELS[activeSignal] ?? '-'}</div></div>
      </div>

      <Waveform ch1={data.dataCH1} ch2={data.dataCH2} mode={data.modeTampilan}/>

      <div className="oscillo-specs">
        <div className="card spec-card"><div className="spec-icon">〽️</div><div className="spec-label">Sinyal CH1</div><div className="spec-val">{SIGNAL_LABELS[data.tipeSinyalCH1] ?? '-'}</div><div className="spec-sub">DAC pin 25 · ADC pin 34</div></div>
        <div className="card spec-card"><div className="spec-icon">〽️</div><div className="spec-label">Sinyal CH2</div><div className="spec-val">{SIGNAL_LABELS[data.tipeSinyalCH2] ?? '-'}</div><div className="spec-sub">DAC pin 26 · ADC pin 35</div></div>
        <div className="card spec-card"><div className="spec-icon">🖥️</div><div className="spec-label">Mode OLED</div><div className="spec-val">{MODE_LABELS[data.modeTampilan] ?? '-'}</div><div className="spec-sub">0–5 seperti kode ESP</div></div>
        <div className="card spec-card"><div className="spec-icon">📊</div><div className="spec-label">Sample CH1</div><div className="spec-val">{data.dataCH1.length}</div><div className="spec-sub">Array dataCH1</div></div>
        <div className="card spec-card"><div className="spec-icon">📊</div><div className="spec-label">Sample CH2</div><div className="spec-val">{data.dataCH2.length}</div><div className="spec-sub">Array dataCH2</div></div>
        <div className="card spec-card"><div className="spec-icon">ℹ️</div><div className="spec-label">OSD Info</div><div className="spec-val">{data.tampilInfo ? 'ON' : 'OFF'}</div><div className="spec-sub">Toggle tombol pin 14</div></div>
      </div>

      <div className="two-col">
        <div className="card info-card osc-measure">
          <div className="info-title">Pengukuran CH1</div>
          <div className="measure-grid">
            <div><span>Vpp</span><strong>{data.ch1.vpp.toFixed(2)} V</strong></div>
            <div><span>{data.tipeSinyalCH1 === 1 ? 'Vdc' : 'Freq'}</span><strong>{data.tipeSinyalCH1 === 1 ? `${data.ch1.vdc.toFixed(2)} V` : `${data.ch1.freq.toFixed(0)} Hz`}</strong></div>
            <div><span>Vmax</span><strong>{data.ch1.vmax.toFixed(2)} V</strong></div>
            <div><span>Vmin</span><strong>{data.ch1.vmin.toFixed(2)} V</strong></div>
          </div>
        </div>
        <div className="card info-card osc-measure">
          <div className="info-title">Pengukuran CH2</div>
          <div className="measure-grid">
            <div><span>Vpp</span><strong>{data.ch2.vpp.toFixed(2)} V</strong></div>
            <div><span>{data.tipeSinyalCH2 === 1 ? 'Vdc' : 'Freq'}</span><strong>{data.tipeSinyalCH2 === 1 ? `${data.ch2.vdc.toFixed(2)} V` : `${data.ch2.freq.toFixed(0)} Hz`}</strong></div>
            <div><span>Vmax</span><strong>{data.ch2.vmax.toFixed(2)} V</strong></div>
            <div><span>Vmin</span><strong>{data.ch2.vmin.toFixed(2)} V</strong></div>
          </div>
        </div>
      </div>

      <div className="card info-card">
        <div className="info-title">Struktur data Firebase yang dibaca website</div>
        <div className="code-block">oscilloscope/{deviceId}/latest</div>
        <div className="info-body" style={{marginTop:'12px',marginBottom:0}}>
          Field utama yang wajib dari dummy/ESP: <strong>dataCH1</strong>, <strong>dataCH2</strong>, <strong>tipeSinyalCH1</strong>, <strong>tipeSinyalCH2</strong>, <strong>modeTampilan</strong>, <strong>tampilInfo</strong>, dan <strong>sampleTimeUs</strong>. Website menghitung Vpp/Freq/Vdc langsung dari array ADC.
        </div>
      </div>

      <div className="foot-note">
        <div>Firebase path: <span>oscilloscope/{deviceId}/latest</span></div>
        <div>{error || `OSD aktif: ${activeCH} · Vpp ${activeMetric.vpp.toFixed(2)} V`}</div>
      </div>

      {showModal && <Modal deviceId={temp} setDeviceId={setTemp} onClose={()=>setShowModal(false)}
        onSave={()=>{setDeviceId(temp.trim()||'lab01');setShowModal(false)}}/>}
    </>
  )
}

/* ─────────────────────────────── ABOUT US ─── */
const AboutUs = () => {
  const initials = (n: string) => n.split(' ').slice(0,2).map(w=>w[0]).join('')
  return (
    <>
      <div className="card">
        <div className="about-header">
          <div className="about-eyebrow">Tentang Kami</div>
          <div className="about-title">Tim Kelompok — Tubes Sispeng</div>
          <div className="about-sub">
            Kelompok EP2004 Sistem Pengukuran yang mengerjakan tiga proyek alat ukur berbasis ESP32: KWH Meter, Cable Fault Detector, dan Osiloskop Digital.
          </div>
        </div>
        <div style={{padding:'20px'}}>
          <div className="team-grid">
            {TEAM.map(m=>(
              <div key={m.nim} className="card team-card">
                <div>
                  <img src={m.photo} alt={m.name} className="team-photo"
                    onError={e=>{
                      (e.target as HTMLImageElement).style.display='none';
                      const el = document.createElement('div');
                      el.className='team-photo-fallback';
                      el.textContent=initials(m.name);
                      (e.target as HTMLImageElement).parentElement?.insertBefore(el,e.target as HTMLImageElement);
                    }}
                  />
                </div>
                <div>
                  <div className="team-name">{m.name}</div>
                  <div className="team-nim">NIM {m.nim}</div>
                  <div className="team-role">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────── ROOT APP ─── */
export default function App() {
  const [view, setView] = useState<ActiveView>('kwh')

  const NAV: {id: ActiveView; label: string}[] = [
    {id:'kwh',    label:'KWH Meter'},
    {id:'cable',  label:'Cable Fault Detector'},
    {id:'oscillo',label:'Osiloskop'},
    {id:'about',  label:'Tentang Kami'},
  ]

  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <span className="topbar-title">Tubes Sispeng</span>
            <span className="topbar-sub">EP2004</span>
          </div>
          <div className="topbar-nav">
            {NAV.map(n=>(
              <button key={n.id} className={`nav-tab ${view===n.id?'active':''}`} onClick={()=>setView(n.id)}>
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="page">
        {view==='kwh'    && <KwhMeter/>}
        {view==='cable'  && <CableFault/>}
        {view==='oscillo'&& <Oscillo/>}
        {view==='about'  && <AboutUs/>}
      </div>
    </div>
  )
}

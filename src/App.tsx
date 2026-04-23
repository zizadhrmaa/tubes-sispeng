import { useEffect, useMemo, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { db } from './firebase'
import './index.css'

interface KwhData {
  voltage: number
  current: number
  power: number
  energy: number
  frequency: number
  pf: number
  connected: boolean
  timestamp: string
}

interface FirebaseLatest {
  voltage?: number
  current?: number
  power?: number
  energy?: number
  frequency?: number
  pf?: number
  connected?: boolean
  timestamp?: number | string
}

interface HistoryPoint {
  time: string
  voltage: number
  current: number
  power: number
}

interface TeamMember {
  name: string
  nim: string
  description: string
  photo: string
}

const EMPTY_DATA: KwhData = {
  voltage: 0,
  current: 0,
  power: 0,
  energy: 0,
  frequency: 0,
  pf: 0,
  connected: false,
  timestamp: '-',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
  
const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Aziza Dharma Putri',
    nim: '13524017',
    description: 'Berfokus pada perancangan dan pengembangan website monitoring agar data kelistrikan dapat ditampilkan dengan baik.',
    photo: '/team/aziza.jpg',
  },
  {
    name: 'Muchammad Asshiddiqi',
    nim: '18024016',
    description: 'Berfokus pada penyusunan laporan proyek agar seluruh proses perancangan dan hasil pengujian terdokumentasi dengan baik.',
    photo: '/team/diqi.jpg',
  },
  {
    name: 'Rasyid Abdurrahman',
    nim: '18024056',
    description: 'Berfokus pada pembuatan rangkaian alat bersama tim hardware agar sistem dapat bekerja sesuai perancangan.',
    photo: '/team/ocid.jpg',
  },
  {
    name: 'Nathanael Pramanugraha',
    nim: '18024048',
    description: 'Berfokus pada pembuatan video sebagai media dokumentasi dan presentasi hasil proyek.',
    photo: '/team/nael.jpg',
  },
  {
    name: 'Aldito Zahran Habibi',
    nim: '18024006',
    description: 'Berfokus pada pembuatan poster proyek serta pengadaan bahan yang dibutuhkan selama proses perakitan.',
    photo: '/team/aldito.jpg',
  },
  {
    name: 'Khairul Arief Rahman',
    nim: '18024008',
    description: 'Berfokus pada pembuatan rangkaian alat bersama tim hardware untuk memastikan integrasi komponen berjalan dengan baik.',
    photo: '/team/khairul.jpg',
  },
]
const LineChart = ({
  data,
  field,
}: {
  data: HistoryPoint[]
  field: keyof Omit<HistoryPoint, 'time'>
}) => {
  if (data.length < 2) {
    return <div className="chart-empty">Menunggu data masuk...</div>
  }

  const values = data.map(item => item[field] as number)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = 260
  const height = 72
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${field}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#gradient-${field})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const MetricCard = ({
  title,
  value,
  unit,
  accent,
  description,
  history,
  field,
}: {
  title: string
  value: number
  unit: string
  accent: 'blue' | 'pink'
  description: string
  history: HistoryPoint[]
  field: keyof Omit<HistoryPoint, 'time'>
}) => {
  const progressBase = useMemo(() => {
    if (field === 'voltage') return Math.min((value / 250) * 100, 100)
    if (field === 'current') return Math.min((value / 10) * 100, 100)
    return Math.min((value / 2200) * 100, 100)
  }, [field, value])

  return (
    <section className={`metric-card accent-${accent}`}>
      <div className="metric-top">
        <div>
          <p className="metric-label">{title}</p>
          <div className="metric-value-wrap">
            <h3 className="metric-value">{value.toFixed(field === 'current' ? 3 : 1)}</h3>
            <span className="metric-unit">{unit}</span>
          </div>
        </div>
        <div className="metric-dot" />
      </div>

      <div className="meter-bar">
        <div className="meter-fill" style={{ width: `${progressBase}%` }} />
      </div>

      <LineChart data={history} field={field} />
      <p className="metric-note">{description}</p>
    </section>
  )
}

const SummaryPill = ({ label, value }: { label: string; value: string }) => (
  <div className="summary-pill">
    <span className="summary-label">{label}</span>
    <strong className="summary-value">{value}</strong>
  </div>
)

const AboutCard = ({ member }: { member: TeamMember }) => (
  <article className="panel about-card">
    <img src={member.photo} alt={member.name} className="about-photo" />
    <div className="about-body">
      <p className="about-label">Team Member</p>
      <h3>{member.name}</h3>
      <div className="about-nim">NIM {member.nim}</div>
      <p className="about-description">{member.description}</p>
    </div>
  </article>
)

const SettingsModal = ({
  tempDeviceId,
  setTempDeviceId,
  onClose,
  onSave,
}: {
  tempDeviceId: string
  setTempDeviceId: (value: string) => void
  onClose: () => void
  onSave: () => void
}) => (
  <div className="modal-backdrop">
    <div className="modal-scrim" onClick={onClose} />
    <div className="modal-card">
      <div className="modal-header">
        <span className="modal-chip">Pengaturan</span>
        <h3>Hubungkan device Firebase</h3>
        <p>Pakai device ID yang sama dengan data di Realtime Database.</p>
      </div>

      <label className="field-block">
        <span>Device ID</span>
        <input
          type="text"
          value={tempDeviceId}
          onChange={event => setTempDeviceId(event.target.value)}
          placeholder="contoh: rumah01"
        />
      </label>

      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onClose}>
          Batal
        </button>
        <button type="button" className="primary-button" onClick={onSave}>
          Simpan
        </button>
      </div>
    </div>
  </div>
)

export default function App() {
  const [deviceId, setDeviceId] = useState('rumah01')
  const [tempDeviceId, setTempDeviceId] = useState('rumah01')
  const [data, setData] = useState<KwhData>(EMPTY_DATA)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [lastError, setLastError] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'about'>('dashboard')

  useEffect(() => {
    const meterRef = ref(db, `meters/${deviceId}/latest`)

    const unsubscribe = onValue(
      meterRef,
      snapshot => {
        const json = snapshot.val() as FirebaseLatest | null

        if (!json) {
          setData(previous => ({ ...previous, connected: false }))
          setLastError('Data untuk device ini belum ada.')
          return
        }

        const localTime = new Date().toLocaleTimeString('id-ID')
        const nextData: KwhData = {
          voltage: Number(json.voltage ?? 0),
          current: Number(json.current ?? 0),
          power: Number(json.power ?? 0),
          energy: Number(json.energy ?? 0),
          frequency: Number(json.frequency ?? 0),
          pf: Number(json.pf ?? 0),
          connected: Boolean(json.connected),
          timestamp: localTime,
        }

        setData(nextData)
        setHistory(previous => [
          ...previous.slice(-23),
          {
            time: localTime,
            voltage: nextData.voltage,
            current: nextData.current,
            power: nextData.power,
          },
        ])
        setLastError('')
      },
      () => {
        setData(previous => ({ ...previous, connected: false }))
        setLastError('Gagal membaca data dari Firebase.')
      }
    )

    return () => unsubscribe()
  }, [deviceId])

  const estimatedCost = data.energy * 1444.7

  return (
    <div className="app-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-pink" />

      <main className="page-wrap">
        <section className="hero-card panel">
          <div className="hero-copy">
            <span className="hero-badge">Smart KWH Meter</span>
            <h1>Dashboard listrik Berbasis ESP32 dan PZEM004T</h1>
            <p>
              Pantau tegangan, arus, daya, energi, dan estimasi biaya dari Firebase secara real time.
            </p>
          </div>

          <div className="hero-actions">
            <div className={`status-pill ${data.connected ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {data.connected ? 'Realtime aktif' : 'Device offline'}
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setTempDeviceId(deviceId)
                setShowSettings(true)
              }}
            >
              Ubah Device ID
            </button>
          </div>
        </section>

        <section className="summary-grid">
          <SummaryPill label="Device" value={deviceId} />
          <SummaryPill label="Update terakhir" value={data.timestamp} />
          <SummaryPill label="Estimasi biaya" value={formatCurrency(estimatedCost)} />
          <SummaryPill label="Power factor" value={data.pf.toFixed(2)} />
        </section>

        <section className="tab-row">
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('history')}
          >
            Riwayat
          </button>
          <button
            type="button"
            className={activeTab === 'about' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('about')}
          >
            About Us
          </button>
        </section>

        {activeTab === 'dashboard' ? (
          <>
            <section className="metrics-grid">
              <MetricCard
                title="Tegangan"
                value={data.voltage}
                unit="Volt"
                accent="blue"
                description="Rentang aman biasanya ada di sekitar 210 sampai 230 volt."
                history={history}
                field="voltage"
              />
              <MetricCard
                title="Arus"
                value={data.current}
                unit="Ampere"
                accent="pink"
                description="Arus naik saat beban listrik bertambah."
                history={history}
                field="current"
              />
              <MetricCard
                title="Daya"
                value={data.power}
                unit="Watt"
                accent="blue"
                description="Daya membantu lihat total konsumsi beban saat ini."
                history={history}
                field="power"
              />
            </section>

            <section className="details-grid">
              <article className="panel detail-card">
                <p className="detail-label">Energi total</p>
                <h3>{data.energy.toFixed(3)} kWh</h3>
                <span>Akumulasi energi yang sudah terbaca oleh sistem.</span>
              </article>

              <article className="panel detail-card">
                <p className="detail-label">Frekuensi</p>
                <h3>{data.frequency.toFixed(1)} Hz</h3>
                <span>Menunjukkan kestabilan sumber listrik yang masuk.</span>
              </article>

              <article className="panel detail-card">
                <p className="detail-label">Power factor</p>
                <h3>{data.pf.toFixed(2)}</h3>
                <span>Semakin mendekati 1, semakin efisien pemakaian daya.</span>
              </article>

              <article className="panel detail-card accent-card">
                <p className="detail-label">Estimasi biaya</p>
                <h3>{formatCurrency(estimatedCost)}</h3>
                <span>Perhitungan memakai tarif 1.444,7 rupiah per kWh.</span>
              </article>
            </section>
          </>
        ) : activeTab === 'history' ? (
          <section className="panel history-panel">
            <div className="history-header">
              <div>
                <p className="detail-label">Riwayat pembacaan</p>
                <h3>{history.length} data terakhir</h3>
              </div>
              <span className="history-chip">Realtime stream</span>
            </div>

            {history.length === 0 ? (
              <div className="empty-state">Belum ada data yang masuk.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Waktu</th>
                      <th>Tegangan</th>
                      <th>Arus</th>
                      <th>Daya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((item, index) => (
                      <tr key={`${item.time}-${index}`}>
                        <td>{history.length - index}</td>
                        <td>{item.time}</td>
                        <td>{item.voltage.toFixed(1)} V</td>
                        <td>{item.current.toFixed(3)} A</td>
                        <td>{item.power.toFixed(1)} W</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="about-wrap">
            <div className="about-head panel">
              <div>
                <span className="hero-badge">About Us</span>
                <h2>Tim pengembang Smart KWH Meter</h2>
                <p>
                  Halaman ini menampilkan anggota tim beserta identitas singkat dan peran ringkas di project.
                </p>
              </div>
            </div>

            <div className="about-grid">
              {TEAM_MEMBERS.map(member => (
                <AboutCard key={member.nim} member={member} />
              ))}
            </div>
          </section>
        )}

        <section className="foot-note">
          <div>
            <strong>Status database:</strong> {data.connected ? 'terhubung' : 'tidak terhubung'}
          </div>
          <div>
            <strong>Catatan:</strong> {lastError || 'Semua data masuk dengan normal.'}
          </div>
        </section>
      </main>

      {showSettings && (
        <SettingsModal
          tempDeviceId={tempDeviceId}
          setTempDeviceId={setTempDeviceId}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setDeviceId(tempDeviceId.trim() || 'rumah01')
            setHistory([])
            setShowSettings(false)
          }}
        />
      )}
    </div>
  )
}

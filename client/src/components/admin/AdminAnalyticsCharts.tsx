import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SectionCard } from './AdminUI'

type AnalyticsPayload = {
  users: Array<{ createdAt: string }>
  payments: Array<{ createdAt: string; amount: number }>
  schools: Array<{ createdAt: string }>
  roleDistribution: Array<{ role: 'DIRECTOR' | 'TEACHER' | 'STUDENT'; count: number }>
}

type ChartPoint = {
  label: string
  value: number
}

const roleColors: Record<string, string> = {
  DIRECTOR: '#0f766e',
  TEACHER: '#2563eb',
  STUDENT: '#f59e0b',
}

function formatMonthKey(dateValue: string) {
  const date = new Date(dateValue)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatWeekKey(dateValue: string) {
  const date = new Date(dateValue)
  const day = date.getDay()
  const diff = (day + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function weekLabel(weekKey: string) {
  return new Date(weekKey).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildCountSeries(items: Array<{ createdAt: string }>, formatter: (input: string) => string, toLabel: (key: string) => string): ChartPoint[] {
  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const key = formatter(item.createdAt)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return Object.keys(grouped)
    .sort()
    .map(key => ({ label: toLabel(key), value: grouped[key] }))
}

function buildRevenueSeries(items: Array<{ createdAt: string; amount: number }>): ChartPoint[] {
  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const key = formatMonthKey(item.createdAt)
    acc[key] = (acc[key] || 0) + Number(item.amount || 0)
    return acc
  }, {})

  return Object.keys(grouped)
    .sort()
    .map(key => ({ label: monthLabel(key), value: Math.round(grouped[key]) }))
}

function formatCurrency(value: number) {
  return `N${value.toLocaleString()}`
}

export function AdminAnalyticsCharts({ analytics }: { analytics: AnalyticsPayload }) {
  const userGrowth = buildCountSeries(analytics.users, formatMonthKey, monthLabel)
  const revenueGrowth = buildRevenueSeries(analytics.payments)
  const schoolTrend = buildCountSeries(analytics.schools, formatWeekKey, weekLabel)
  const roleDistribution = analytics.roleDistribution.map(item => ({
    ...item,
    value: item.count,
  }))

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="User Growth" subtitle="Users registered over time.">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#0284c7" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Revenue Chart" subtitle="Successful payments over time.">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(value) => `N${Number(value).toLocaleString()}`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
              <Bar dataKey="value" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="School Registration Trend" subtitle="New schools per week.">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={schoolTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Role Distribution" subtitle="Current role split across Director, Teacher, and Student.">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={roleDistribution} dataKey="value" nameKey="role" innerRadius={65} outerRadius={95} paddingAngle={3}>
                {roleDistribution.map(entry => (
                  <Cell key={entry.role} fill={roleColors[entry.role] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  )
}

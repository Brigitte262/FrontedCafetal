import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { KPICard } from "../components/kpi-card"
import { DataTable } from "../components/data-table"
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend, PolarAngleAxis, Treemap,
  BarChart, Bar
} from "recharts"
import { TrendingUp, Package, ShieldCheck, Truck, Calculator, Users, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDate } from "../lib/utils"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { useDashboardOverview, useDashboardMeta } from "@/hooks/useCafetalApi"
import type { Period } from "@/hooks/useCafetalApi"

// ===== Helpers =====
const fMoney = (n?: number) => formatCurrency(Number.isFinite(n as number) ? (n as number) : 0)
const fPct = (n?: number) => `${Number.isFinite(n as number) ? (n as number).toFixed(1) : "0.0"}%`
const mesCorto = (ym?: string) => {
  if (!ym || ym.length < 7) return ym ?? "—"
  const m = Number(ym.slice(5, 7))
  const nombres = ["Ene.", "Feb.", "Mar.", "Abr.", "May.", "Jun.", "Jul.", "Ago.", "Set.", "Oct.", "Nov.", "Dic."]
  return nombres[(m || 1) - 1] ?? ym
}
const safeISO = (s?: string) => {
  if (!s) return new Date().toISOString()
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}
const NoData = ({ height = 300 }: { height?: number }) => (
  <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
    Sin datos para mostrar
  </div>
)
const notify = (m: string) => { try { window?.alert?.(m) } catch { console.log(m) } }

const COLORS = ["#0ea5e9","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316","#14b8a6","#e11d48"]
const GRADIENT_PRIMARY_FROM = "#0ea5e9"
const GRADIENT_PRIMARY_TO   = "#8b5cf6"
const GRID = "3 3"

const toNum = (v: any, def = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
const toNonNeg = (v: any, def = 0) => {
  const n = toNum(v, def)
  return n < 0 ? 0 : n
}

// ===== Tipos =====
type PuntoVentas  = { month: string; sales: number }
type PuntoCalidad = { month: string; rate: number }
type PuntoStock   = { category: string; stock: number }
type PuntoTop     = { name: string; sales: number }
type DashboardMeta = {
  warehouses?: { id: string | number; name: string }[];
  categories?: { id: string | number; name: string }[];
};

const PERIOD_LABEL: Record<Period, string> = {
  week: "últimos 7 días",
  month: "últimos 30 días",
  quarter: "últimos 3 meses",
  year: "últimos 12 meses",
}

// ===== Mini componentes =====
function SalesComparison({ current, deltaPct }: { current: number; deltaPct: number }) {
  const d = Number(deltaPct) / 100
  const prev = isFinite(d) && d > -1 ? current / (1 + d) : 0
  const data = [
    { name: "Anterior", value: Math.max(0, prev) },
    { name: "Periodo",  value: Math.max(0, current) },
  ]
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Ventas"]} />
        <Legend />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
          <Cell fill="#0ea5e9" />
          <Cell fill="#8b5cf6" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

function QualityGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0))
  const data = [{ name: "Aprobado", value: clamped }]
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={180} endAngle={0}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={10} background fill={GRADIENT_PRIMARY_FROM} />
        <text x="50%" y="60%" textAnchor="middle" className="fill-current">
          <tspan className="text-xl font-semibold">{clamped.toFixed(1)}%</tspan>
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  )
}

function InvoicesByStatus({ invoices }: { invoices: any[] }) {
  const counts = invoices.reduce<Record<string, number>>((acc, it: any) => {
    const s = String(it.status ?? it.state ?? "").toUpperCase() || "UNKNOWN"
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const entries = Object.entries(counts).map(([name, value]) => ({ name, value }))
  if (entries.length === 0) return <NoData />
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Tooltip formatter={(v) => [String(v), "Facturas"]} />
        <Legend />
        <Pie data={entries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
          {entries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

function TopStockCategories({ data }: { data: PuntoStock[] }) {
  if (!data?.length) return <NoData />
  const top = [...data].sort((a, b) => b.stock - a.stock).slice(0, 10)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={top} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="gradStock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GRADIENT_PRIMARY_TO} stopOpacity={0.9} />
            <stop offset="100%" stopColor={GRADIENT_PRIMARY_FROM} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray={GRID} />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => `${Number(v).toLocaleString()} kg`} />
        <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} KG`, "Stock"]} />
        <Area type="monotone" dataKey="stock" stroke={GRADIENT_PRIMARY_TO} fill="url(#gradStock)" strokeWidth={3} dot />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function CategoryChart({ data }: { data: PuntoStock[] }) {
  if (!data?.length) return <NoData />

  if (data.length <= 8) {
    const pieData = data
      .map((d) => ({ name: d.category, value: d.stock }))
      .sort((a, b) => b.value - a.value)

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} kg`, "Stock"]} />
          <Legend />
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const treeData = data
    .map((d, i) => ({ name: d.category, size: d.stock, fill: COLORS[i % COLORS.length] }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap data={treeData} dataKey="size" stroke="#fff" isAnimationActive={false} aspectRatio={4/3} />
    </ResponsiveContainer>
  )
}

// ===== Componente principal =====
export function Dashboard() {
  // catálogos (warehouses, categories) para evitar hardcode
  const { data: metaRaw } = useDashboardMeta();
  const meta = (metaRaw ?? {}) as DashboardMeta; 

  const [period, setPeriod] = React.useState<Period>("month")
  const [warehouseId, setWarehouseId] = React.useState<string>("all")
  const [categoryId, setCategoryId] = React.useState<string>("all")
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const { data, loading, error, refetch } = useDashboardOverview({ period, warehouseId, category: categoryId })
  const periodoLabel = PERIOD_LABEL[period]

  // Series
  const ventasSerie = React.useMemo<PuntoVentas[]>(() => {
    const src = data?.series?.ventas ?? data?.series?.ventas_por_mes ?? []
    return src.map((d: any) => ({
      month: d?.label ?? mesCorto(d?.ym ?? d?.month ?? ""),
      sales: toNonNeg(d?.total ?? d?.value ?? 0),
    }))
  }, [data])

  const stockPorCategoria = React.useMemo<PuntoStock[]>(() => {
    const src = data?.series?.stock_por_categoria ?? []
    return src.map((d: any) => ({
      category: d?.categoria ?? d?.label ?? "—",
      stock: toNonNeg(d?.kg ?? d?.value ?? 0),
    }))
  }, [data])

  const calidadSerie = React.useMemo<PuntoCalidad[]>(() => {
    const src = data?.series?.calidad ?? data?.series?.tasa_aprobacion_calidad ?? []
    return src.map((d: any) => ({
      month: d?.label ?? mesCorto(d?.ym ?? d?.month ?? ""),
      rate: Math.min(100, Math.max(0, toNum(d?.pct ?? d?.value ?? 0))),
    }))
  }, [data])

  const topProducts = React.useMemo<PuntoTop[]>(() => {
    const raw =
      data?.series?.top_productos_vendidos ??
      data?.series?.top_products ??
      data?.series?.ventas_por_producto ??
      data?.series?.product_sales ??
      data?.series?.items ?? []
    return raw
      .map((r: any) => ({
        name: r?.producto ?? r?.product_name ?? r?.name ?? (r?.product_id ? `ID ${r.product_id}` : "—"),
        sales: toNonNeg(r?.qty ?? r?.quantity ?? r?.cantidad ?? r?.total_qty ?? r?.units ?? r?.amount ?? r?.total ?? 0),
      }))
      .filter((x) => x.name && x.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)
  }, [data])

  // KPIs
  const ventasActual = toNonNeg(data?.kpis?.ventas_periodo ?? data?.kpis?.ventas_mes ?? 0)
  const deltaVentas  = toNum(data?.kpis?.delta_ventas ?? data?.kpis?.delta_ventas_mes ?? 0)
  const aprobacionActual = Math.min(100, Math.max(0, toNum(data?.kpis?.lotes_aprobados_pct ?? 0)))
  const invoices = (data as any)?.series?.invoices ?? (data as any)?.invoices ?? []

  const ventasPrev = (() => { const d = Number(deltaVentas)/100; return isFinite(d) && d > -1 ? ventasActual/(1+d) : 0 })()
  const ventasValuePretty = ventasActual > 0 ? fMoney(ventasActual) : (ventasPrev > 0 ? `~ ${fMoney(ventasPrev)} (ant.)` : fMoney(0))
  const nominaNum = Number(data?.kpis?.nomina_periodo ?? data?.kpis?.nomina_mes ?? 0)
  const nominaValuePretty = nominaNum > 0 ? fMoney(nominaNum) : (data?.kpis?.empleados_activos ? `${data.kpis.empleados_activos} empleados` : fMoney(0))

  const kpis = [
    { title: "Ventas del Periodo", value: ventasValuePretty, delta: deltaVentas, deltaType: deltaVentas >= 0 ? "up" : "down", tooltip: "Suma de ventas del periodo seleccionado", icon: TrendingUp },
    { title: "Stock Total", value: `${(data?.kpis?.stock_total_kg ?? 0).toLocaleString()} KG`, delta: 0, deltaType: "neutral", tooltip: "Inventario total en kg", icon: Package },
    { title: "Lotes Aprobados", value: fPct(aprobacionActual), delta: data?.kpis?.delta_lotes_aprobados ?? 0, deltaType: (data?.kpis?.delta_lotes_aprobados ?? 0) >= 0 ? "up" : "down", tooltip: "Aprobación de calidad", icon: ShieldCheck },
    { title: "Entregas a Tiempo", value: fPct(data?.kpis?.entregas_a_tiempo_pct), delta: data?.kpis?.delta_entregas ?? 0, deltaType: (data?.kpis?.delta_entregas ?? 0) >= 0 ? "up" : "down", tooltip: "Órdenes entregadas dentro del SLA", icon: Truck },
    { title: "Costo de Producción", value: fMoney(data?.kpis?.costo_produccion_periodo ?? data?.kpis?.costo_produccion_mes), delta: data?.kpis?.delta_costo_produccion ?? 0, deltaType: (data?.kpis?.delta_costo_produccion ?? 0) <= 0 ? "up" : "down", tooltip: "Costos del periodo seleccionado", icon: Calculator },
    { title: "Nómina del Periodo", value: nominaValuePretty, delta: 0, deltaType: "neutral", tooltip: "Total de sueldos del periodo seleccionado", icon: Users },
  ]

  // Alertas
  const alerts = React.useMemo(() => {
    const a = data?.alertas
    if (!a) return []
    const rows: any[] = []
    ;(a.stock_bajo ?? []).forEach((x: any) => rows.push({
      id: `stock-${x.product_id ?? x.name}`,
      title: "Stock bajo",
      description: `${x.name ?? "Producto"} — ${Math.round(x.qty ?? 0)} / mín ${x.min_stock ?? "-"}`,
      severity: "warning",
      date: new Date().toISOString().slice(0, 10),
      action: "Generar OC",
      product_id: x.product_id, name: x.name, min_stock: x.min_stock, qty: x.qty
    }))
    ;(a.orden_produccion_atrasada ?? []).forEach((x: any) => rows.push({
      id: `op-${x.productionorder_id ?? x.production_order_id ?? x.order_id ?? crypto.randomUUID()}`,
      title: `Orden ${x.code ?? "OP"} con retraso`,
      description: `Vence: ${x.due_date?.slice(0, 10) ?? "-"}`,
      severity: "error",
      date: safeISO(x.due_date),
      action: "Revisar",
    }))
    ;(a.facturas_vencidas ?? []).forEach((x: any) => rows.push({
      id: `inv-${x.invoice_id ?? crypto.randomUUID()}`,
      title: `Factura ${x.number ?? x.inv_code ?? ""} vencida`,
      description: `Vence: ${x.due_date?.slice(0, 10) ?? "-"} — ${fMoney(x.total_amount)}`,
      severity: "error",
      date: safeISO(x.due_date),
      action: "Gestionar",
    }))
    ;(a.lotes_pendientes_aprobacion ?? []).forEach((x: any) => rows.push({
      id: `qt-${x.qualitytest_id ?? crypto.randomUUID()}`,
      title: `Lote ${x.lot_id ?? "-"} pendiente de aprobación`,
      description: `Test: ${x.test_date?.slice(0, 10) ?? "-"}`,
      severity: "warning",
      date: safeISO(x.test_date),
      action: "Aprobar",
    }))
    return rows
  }, [data])

  // Handlers
  const handleGenerateOC = (row: any) => {
    const min = Number(row?.min_stock ?? 0)
    const have = Number(row?.qty ?? 0)
    const suggestedQty = Math.max(0, min - have)
    const pid = row?.product_id ?? row?.id ?? ""
    const pname = row?.name ?? "Producto"
    // router.push(`/compras/oc/nueva?productId=${pid}&qty=${suggestedQty}`)
    notify(`Generar OC → ${pname}${pid ? ` (ID ${pid})` : ""}, sugerido: ${suggestedQty}`)
  }

  const handleRefetch = async () => {
    setRefreshing(true)
    await refetch()
    setLastUpdated(new Date().toLocaleTimeString())
    setRefreshing(false)
  }

  const alertColumns = React.useMemo(() => ([
    {
      accessorKey: "title",
      header: "Alerta",
      cell: ({ row }: any) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.title}</div>
          <div className="text-sm text-muted-foreground">{row.original.description}</div>
        </div>
      ),
    },
    {
      accessorKey: "severity",
      header: "Severidad",
      cell: ({ row }: any) => {
        const sev = row.original.severity
        return (
          <Badge
            variant={sev === "error" ? "destructive" : "secondary"}
            className={sev === "warning" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" : ""}
          >
            {sev === "error" ? "Crítico" : "Advertencia"}
          </Badge>
        )
      },
    },
    { accessorKey: "date", header: "Fecha", cell: ({ row }: any) => formatDate(row.original.date) },
    {
      accessorKey: "action",
      header: "Acción",
      cell: ({ row }: any) => (
        <Button variant="outline" size="sm" onClick={() => handleGenerateOC(row.original)}>
          {row.original.action ?? "Generar OC"}
        </Button>
      ),
    },
  ]), [])

  const errorText = React.useMemo(() => {
    if (!error) return null
    return typeof error === "string" ? error : (error as Error)?.message ?? "Error"
  }, [error])

  // ===== UI =====
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k, i) => (
          <KPICard
            key={i}
            title={k.title}
            value={k.value}
            delta={`${Number(k.delta ?? 0).toFixed(1)}%`}
            deltaType={k.deltaType as any}
            icon={k.icon as any}
            tooltip={k.tooltip}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Ventas por periodo */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Periodo</CardTitle>
            <CardDescription>Evolución de ventas en los {periodoLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {ventasSerie.length >= 2 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={ventasSerie} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GRADIENT_PRIMARY_FROM} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={GRADIENT_PRIMARY_TO} stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Ventas"]} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke={GRADIENT_PRIMARY_FROM}
                    fill="url(#gradVentas)"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <SalesComparison current={ventasActual} deltaPct={deltaVentas} />
            )}
          </CardContent>
        </Card>

        {/* Stock por categoría - BARRAS HORIZONTALES */}
        <Card>
          <CardHeader>
            <CardTitle>Stock por Categoría</CardTitle>
            <CardDescription>Distribución actual del inventario</CardDescription>
          </CardHeader>
          <CardContent>
            {stockPorCategoria.length === 0 ? (
              <NoData />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stockPorCategoria} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis type="number" tickFormatter={(v) => `${Number(v).toLocaleString()} kg`} />
                  <YAxis type="category" dataKey="category" width={160} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} KG`, "Stock"]} />
                  <Bar dataKey="stock" barSize={16}>
                    {stockPorCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasa de aprobación */}
        <Card>
          <CardHeader>
            <CardTitle>Tasa de Aprobación de Calidad</CardTitle>
            <CardDescription>Porcentaje de lotes aprobados en los {periodoLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {calidadSerie.length >= 2 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={calidadSerie} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Aprobación"]} />
                  <Line type="monotone" dataKey="rate" stroke={GRADIENT_PRIMARY_TO} strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <QualityGauge pct={aprobacionActual} />
            )}
          </CardContent>
        </Card>

        {/* Top productos (con fallbacks) */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Productos Vendidos</CardTitle>
            <CardDescription>Productos con mayor volumen en los {periodoLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}`, "Unidades"]} />
                  <Legend />
                  <Pie data={topProducts} dataKey="sales" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                    {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : invoices?.length > 0 ? (
              <>
                <CardDescription className="mb-2">
                  Sin ventas con detalle de producto. Te muestro facturas por estado.
                </CardDescription>
                <InvoicesByStatus invoices={invoices} />
              </>
            ) : (
              <>
                <CardDescription className="mb-2">
                  No hay ventas por producto ni facturas disponibles. Te muestro las categorías con más stock.
                </CardDescription>
                <TopStockCategories data={stockPorCategoria} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas Operativas
            </CardTitle>
            <CardDescription>Situaciones que requieren atención inmediata</CardDescription>
          </div>
          <Badge variant="destructive" className="ml-auto">
            {(alerts.filter((a: any) => a.severity === "error") ?? []).length} Críticas
          </Badge>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={alertColumns as any}
            data={alerts}
            searchKey="title"
            searchPlaceholder="Buscar alertas..."
          />
        </CardContent>
      </Card>

      {errorText && <p className="text-sm text-destructive">Error: {errorText}</p>}
    </div>
  )
}







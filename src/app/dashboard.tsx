import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { KPICard } from "../components/kpi-card"
import { DataTable } from "../components/data-table"
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend, PolarAngleAxis,
  Treemap, BarChart, Bar, ReferenceLine, ComposedChart
} from "recharts"
import { TrendingUp, Package, ShieldCheck, Truck, Calculator, Users, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDate } from "../lib/utils"
import { Badge } from "../components/ui/badge"
import { Button } from "../components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select"

// ⬇️ IMPORTA TAMBIÉN useDashboardMeta y el tipo Period
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
const notify = (m: string) => { try { (window as any)?.alert?.(m) } catch { console.log(m) } }

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
const randomId = () => {
  try {
    // SSR-safe
    // @ts-ignore
    return (typeof crypto !== "undefined" && crypto?.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

const CARD_ELEVATED =
  "rounded-2xl bg-white dark:bg-neutral-900 " +
  "ring-1 ring-amber-900/10 dark:ring-amber-200/20 " + // tono café suave
  "!shadow-md hover:!shadow-2xl transition-all duration-300 " + // sombra y animación
  "hover:-translate-y-0.5"; // leve “lift”


// ===== Tipos =====
type PuntoVentas  = { month: string; sales: number }
type PuntoCalidad = { month: string; rate: number }
type PuntoStock   = { category: string; stock: number }
type PuntoTop     = { name: string; sales: number }
type PuntoCostos = { month: string; cost: number }
type PieEntry    = { name: string; value: number }
type MargenRow = {
  ym: string; month: string;
  ventas: number; costos: number;
  margen: number; margenPct: number;
}


// Tipo local para meta (para el header)
type DashboardMeta = {
  warehouses?: { id: number | string; code?: string; name: string }[]
  categories?: { id: number | string; name: string }[]
}

const PERIOD_LABEL: Record<Period, string> = {
  week: "últimos 7 días",
  month: "últimos 30 días",
  quarter: "últimos 3 meses",
  year: "últimos 12 meses",
}



// ===== Mini componentes =====
function SalesComparison({ current, deltaPct }: { current: number; deltaPct: number }) {
  const d = Number(deltaPct) / 100
  const prev = Number.isFinite(d) && d > -1 ? current / (1 + d) : 0
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
  const entries = Object.entries(counts).map(([name, value]: [string, number]) => ({ name, value }))
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
  const top = [...data]
    .sort((a: PuntoStock, b: PuntoStock) => b.stock - a.stock)
    .slice(0, 10)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={top} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="gradStock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={GRADIENT_PRIMARY_TO}   stopOpacity={0.9} />
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
      .sort((a: { name: string; value: number }, b: { name: string; value: number }) => b.value - a.value)

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

  const treeData = data.map((d, i) => ({ name: d.category, size: d.stock, fill: COLORS[i % COLORS.length] }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap data={treeData} dataKey="size" stroke="#fff" isAnimationActive={false} aspectRatio={4/3} />
    </ResponsiveContainer>
  )
}

// ===== Componente principal =====
export function Dashboard() {
  // ⬇️ Estados con SETTERS (antes estaban sin setter)
  const [period, setPeriod] = React.useState<Period>("month")
  const [warehouseId, setWarehouseId] = React.useState<string>("all")
  const [categoryId, setCategoryId] = React.useState<string>("all")
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)


  // ⬇️ Traer meta para llenar selects
  const { data: metaRaw } = useDashboardMeta()
  const meta = (metaRaw ?? {}) as DashboardMeta

  const { data, loading, error, refetch } = useDashboardOverview({ period, warehouseId, category: categoryId })
  const periodoLabel = PERIOD_LABEL[period]

  const s = React.useMemo(() => (data?.series ?? {}) as Record<string, any>, [data])
  const k = React.useMemo(() => (data?.kpis   ?? {}) as Record<string, any>, [data])
  

  // Series
  const ventasSerie = React.useMemo<PuntoVentas[]>(() => {
    const src = s.ventas ?? s.ventas_por_mes ?? []
    return src.map((d: any) => ({
      month: d?.label ?? mesCorto(d?.ym ?? d?.month ?? ""),
      sales: toNonNeg(d?.total ?? d?.value ?? 0),
    }))
  }, [s])

  const stockPorCategoria = React.useMemo<PuntoStock[]>(() => {
    const src = s.stock_por_categoria ?? []
    return src.map((d: any) => ({
      category: d?.categoria ?? d?.label ?? "—",
      stock: toNonNeg(d?.kg ?? d?.value ?? 0),
    }))
  }, [s])

  const margenMensual = React.useMemo<MargenRow[]>(() => {
  const v = (s.ventas_por_mes ?? []) as Array<{ ym: string; total: number }>
  const c = (s.costos_por_mes ?? []) as Array<{ ym: string; total: number }>

  // índice rápido de costos por ym
  const costosPorYm = new Map(c.map(x => [x.ym, toNonNeg(x.total)]))

  return v.map(x => {
    const ventas = toNonNeg(x.total)
    const costos = toNonNeg(costosPorYm.get(x.ym) ?? 0)
    const margen = Math.max(0, ventas - costos)
    const margenPct = ventas > 0 ? (margen / ventas) * 100 : 0
    return { ym: x.ym, month: mesCorto(x.ym), ventas, costos, margen, margenPct }
  })
}, [s])

  const stockPorEstado = React.useMemo<PieEntry[]>(() => {
  const src =
    (s?.stock_por_estado as Array<{ estado?: string; state?: string; kg?: number; value?: number }>) ?? []
  return src.map((d) => ({
    name: String(d?.estado ?? d?.state ?? "—"),
    value: toNonNeg(d?.kg ?? d?.value ?? 0),
  }))
}, [s])

  const calidadSerie = React.useMemo<PuntoCalidad[]>(() => {
    const src = s.calidad ?? s.tasa_aprobacion_calidad ?? []
    return src.map((d: any) => ({
      month: d?.label ?? mesCorto(d?.ym ?? d?.month ?? ""),
      rate: Math.min(100, Math.max(0, toNum(d?.pct ?? d?.value ?? 0))),
    }))
  }, [s])

  // Costos por mes
const costosSerie = React.useMemo<PuntoCostos[]>(() => {
  const src = s.costos_por_mes ?? []
  return src.map((d: any) => ({
    month: d?.label ?? mesCorto(d?.ym ?? d?.month ?? ""),
    cost:  toNonNeg(d?.total ?? d?.value ?? 0),
  }))
}, [s])

// OP por estado (para donut)
const opEstados = React.useMemo<PieEntry[]>(() => {
  const src = s.op_por_estado ?? []
  return src.map((d: any) => ({
    name: String(d?.estado ?? d?.status ?? "—"),
    value: toNonNeg(d?.count ?? d?.qty ?? 0),
  }))
}, [s])

// Merged para Ventas vs Costos
const ventasVsCostos = React.useMemo(() => {
  const map = new Map<string, { month: string; ventas: number; costos: number }>()
  ventasSerie.forEach(v => map.set(v.month, { month: v.month, ventas: v.sales, costos: 0 }))
  costosSerie.forEach(c => {
    const row = map.get(c.month) ?? { month: c.month, ventas: 0, costos: 0 }
    row.costos = c.cost
    map.set(c.month, row)
  })
  return Array.from(map.values())
}, [ventasSerie, costosSerie])


  const topProducts = React.useMemo<PuntoTop[]>(() => {
    const raw: any[] =
      s.top_productos_vendidos ??
      s.top_products ??
      s.ventas_por_producto ??
      s.product_sales ??
      s.items ?? []

    return raw
      .map((r: any): PuntoTop => ({
        name: r?.producto ?? r?.product_name ?? r?.name ?? (r?.product_id ? `ID ${r.product_id}` : "—"),
        sales: toNonNeg(r?.qty ?? r?.quantity ?? r?.cantidad ?? r?.total_qty ?? r?.units ?? r?.amount ?? r?.total ?? 0),
      }))
      .filter((x: PuntoTop) => Boolean(x.name) && x.sales > 0)
      .sort((a: PuntoTop, b: PuntoTop) => b.sales - a.sales)
      .slice(0, 10)
  }, [s])

  // KPIs
 const ventasActual     = toNonNeg(k.ventas_periodo ?? k.ventas_mes ?? 0)
const deltaVentas      = toNum(k.delta_ventas ?? k.delta_ventas_mes ?? 0)
const aprobacionActual = Math.min(100, Math.max(0, toNum(k.lotes_aprobados_pct ?? 0)))
const nominaNum        = Number(k.nomina_periodo ?? k.nomina_mes ?? 0)

// —— NUEVO: cálculos para el card de Margen Bruto (PON ESTO ANTES DEL ARRAY kpis) ——
const costoPeriodo     = toNonNeg(k.costo_produccion_periodo ?? k.costo_produccion_mes ?? 0)
const margenBrutoValor = Math.max(0, ventasActual - costoPeriodo)
const margenBrutoPct   = ventasActual > 0 ? ((ventasActual - costoPeriodo) / ventasActual) * 100 : 0
const deltaMargen      = toNum(k.delta_ventas ?? 0) - toNum(k.delta_costo_produccion ?? 0)

// Formateados
const ventasValuePretty = fMoney(ventasActual)
const nominaValuePretty = fMoney(nominaNum)
  const kpis = [
  { title: "Ventas del Periodo", value: ventasValuePretty, delta: deltaVentas,
    deltaType: deltaVentas >= 0 ? "up" : "down", tooltip: "Suma de ventas del periodo seleccionado",
    icon: TrendingUp },

  { title: "Stock Total", value: `${(k?.stock_total_kg ?? 0).toLocaleString()} KG`, delta: 0,
    deltaType: "neutral", tooltip: "Inventario total en kg", icon: Package },

  { title: "Lotes Aprobados", value: fPct(aprobacionActual), delta: k?.delta_lotes_aprobados ?? 0,
    deltaType: (k?.delta_lotes_aprobados ?? 0) >= 0 ? "up" : "down", tooltip: "Aprobación de calidad",
    icon: ShieldCheck },

  { title: "Entregas a Tiempo", value: fPct(k?.entregas_a_tiempo_pct), delta: k?.delta_entregas ?? 0,
    deltaType: (k?.delta_entregas ?? 0) >= 0 ? "up" : "down", tooltip: "Órdenes entregadas dentro del SLA",
    icon: Truck },

  { title: "Costo de Producción", value: fMoney(k?.costo_produccion_periodo ?? k?.costo_produccion_mes),
    delta: k?.delta_costo_produccion ?? 0, deltaType: (k?.delta_costo_produccion ?? 0) <= 0 ? "up" : "down",
    tooltip: "Costos del periodo seleccionado", icon: Calculator },

  // —— REEMPLAZA el card de Nómina por este ——
  { title: "Margen Bruto",
    value: `${fMoney(margenBrutoValor)} • ${margenBrutoPct.toFixed(1)}%`,
    delta: deltaMargen,
    deltaType: deltaMargen >= 0 ? "up" : "down",
    tooltip: "Ventas – Costos del periodo seleccionado",
    icon: Calculator },
]


  // Alertas
  const alerts = React.useMemo(() => {
    const a = (data as any)?.alertas
    if (!a) return [] as any[]
    const rows: any[] = []

    ;(a.stock_bajo ?? []).forEach((x: any) => rows.push({
      id: `stock-${x.product_id ?? x.name ?? randomId()}`,
      title: "Stock bajo",
      description: `${x.name ?? "Producto"} — ${Math.round(x.qty ?? 0)} / mín ${x.min_stock ?? "-"}`,
      severity: "warning",
      date: new Date().toISOString().slice(0, 10),
      action: "Generar OC",
      product_id: x.product_id, name: x.name, min_stock: x.min_stock, qty: x.qty
    }))

    ;(a.orden_produccion_atrasada ?? []).forEach((x: any) => rows.push({
      id: `op-${x.productionorder_id ?? x.production_order_id ?? x.order_id ?? randomId()}`,
      title: `Orden ${x.code ?? "OP"} con retraso`,
      description: `Vence: ${x.due_date?.slice(0, 10) ?? "-"}`,
      severity: "error",
      date: safeISO(x.due_date),
      action: "Revisar",
    }))

    ;(a.facturas_vencidas ?? []).forEach((x: any) => rows.push({
      id: `inv-${x.invoice_id ?? randomId()}`,
      title: `Factura ${x.number ?? x.inv_code ?? ""} vencida`,
      description: `Vence: ${x.due_date?.slice(0, 10) ?? "-"} — ${fMoney(x.total_amount)}`,
      severity: "error",
      date: safeISO(x.due_date),
      action: "Gestionar",
    }))

    ;(a.lotes_pendientes_aprobacion ?? []).forEach((x: any) => rows.push({
      id: `qt-${x.qualitytest_id ?? randomId()}`,
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

  ]), [])

  const errorText = React.useMemo(() => {
    if (!error) return null
    return typeof error === "string" ? error : (error as Error)?.message ?? "Error"
  }, [error])

  // ===== UI =====
  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Reportes relevantes para el Área de Gerencia</h1>

        <div className="ml-auto flex items-center gap-2">
          {/* Filtro: Periodo */}
          <Select
            value={period}
            onValueChange={(v: string) => setPeriod(v as Period)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Últimos 7 días</SelectItem>
              <SelectItem value="month">Últimos 30 días</SelectItem>
              <SelectItem value="quarter">Últimos 3 meses</SelectItem>
              <SelectItem value="year">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro: Almacén */}
          <Select
            value={warehouseId}
            onValueChange={(v: string) => setWarehouseId(v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {(meta?.warehouses ?? []).map(
                (w: { id: number | string; name: string; code?: string }) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {/* Filtro: Categoría */}
          <Select
            value={categoryId}
            onValueChange={(v: string) => setCategoryId(v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {(meta?.categories ?? []).map(
                (c: { id: number | string; name: string }) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={handleRefetch}
            disabled={loading || refreshing}
          >
            {refreshing ? "Actualizando..." : "Refrescar"}
          </Button>

          {lastUpdated && (
            <span className="text-xs text-muted-foreground ml-1">
              Actualizado {lastUpdated}
            </span>
          )}
        </div>
      </div>

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
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Ventas por Periodo</CardTitle>
            <CardDescription>
              Evolución de ventas en los {periodoLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ventasSerie.length >= 2 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={ventasSerie}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={GRADIENT_PRIMARY_FROM}
                        stopOpacity={0.9}
                      />
                      <stop
                        offset="100%"
                        stopColor={GRADIENT_PRIMARY_TO}
                        stopOpacity={0.2}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v)), "Ventas"]}
                  />
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

        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Margen Bruto Mensual</CardTitle>
            <CardDescription>
              Valor (S/) y porcentaje del margen por mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {margenMensual.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={margenMensual}
                  margin={{ top: 8, right: 16, left: 8, bottom: 6 }}
                >
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis dataKey="month" />
                  <YAxis
                    yAxisId="s"
                    width={84}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <YAxis
                    yAxisId="p"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${Number(v).toFixed(0)}%`} 
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, item: any) => {
                      return item?.dataKey === "margenPct"
                        ? [`${Number(value).toFixed(1)}%`, "Margen %"]
                        : [formatCurrency(Number(value)), "Margen (S/)"];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="s"
                    dataKey="margen"
                    name="Margen (S/)" // <- corregido
                    barSize={18}
                    fill={GRADIENT_PRIMARY_FROM}
                  />
                  <Line
                    yAxisId="p"
                    type="monotone"
                    dataKey="margenPct"
                    name="Margen %"
                    stroke={GRADIENT_PRIMARY_TO}
                    strokeWidth={3}
                    dot
                  />
                  <ReferenceLine
                    yAxisId="p"
                    y={35}
                    label="Meta 35%"
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <NoData />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Órdenes de Producción por Estado</CardTitle>
            <CardDescription>Backlog y avance del periodo</CardDescription>
          </CardHeader>
          <CardContent>
            {opEstados.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Tooltip formatter={(v) => [String(v), "Órdenes"]} />
                  <Legend />
                  <Pie
                    data={opEstados}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {opEstados.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <NoData />
            )}
          </CardContent>
        </Card>

        {/* Stock por categoría - BARRAS HORIZONTALES */}
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Stock por Categoría</CardTitle>
            <CardDescription>
              Distribución actual del inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stockPorCategoria.length === 0 ? (
              <NoData />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={stockPorCategoria}
                  layout="vertical"
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${Number(v).toLocaleString()} kg`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={160}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(v) => [
                      `${Number(v).toLocaleString()} KG`,
                      "Stock",
                    ]}
                  />
                  <Bar dataKey="stock" barSize={16}>
                    {stockPorCategoria.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasa de aprobación */}
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Tasa de Aprobación de Calidad</CardTitle>
            <CardDescription>
              Porcentaje de lotes aprobados en los {periodoLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calidadSerie.length >= 2 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={calidadSerie}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray={GRID} />
                  <XAxis dataKey="month" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${Number(v)}%`}
                  />
                  <Tooltip formatter={(v) => [`${Number(v)}%`, "Aprobación"]} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={GRADIENT_PRIMARY_TO}
                    strokeWidth={3}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <QualityGauge pct={aprobacionActual} />
            )}
          </CardContent>
        </Card>

        {/* Top productos (con fallbacks) */}
        <Card className="shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle>Top 10 Productos Vendidos</CardTitle>
            <CardDescription>
              Productos con mayor volumen en los {periodoLabel}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Tooltip
                    formatter={(v) => [
                      `${Number(v).toLocaleString()}`,
                      "Unidades",
                    ]}
                  />
                  <Legend />
                  <Pie
                    data={topProducts}
                    dataKey="sales"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {topProducts.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <>
                <CardDescription className="mb-2">
                  No hay ventas por producto ni facturas disponibles. Te muestro
                  las categorías con más stock.
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
            <CardDescription>
              Situaciones que requieren atención inmediata
            </CardDescription>
          </div>
          <Badge variant="destructive" className="ml-auto">
            {alerts.filter((a: any) => a.severity === "error").length} Críticas
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

      {errorText && (
        <p className="text-sm text-destructive">Error: {errorText}</p>
      )}
    </div>
  );
}










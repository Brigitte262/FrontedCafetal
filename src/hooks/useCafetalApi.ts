// src/hooks/useCafetalApi.ts
import * as React from "react"

/* =========================================
 * Tipos base
 * =======================================*/
export type Period = "week" | "month" | "quarter" | "year"

export type Warehouse = { id: number; code: string; name: string }
export type Uom       = { id: number; code: string; description: string }
export type Product   = { id: number; sku: string; name: string; category: string; uom: string }

export type Page<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}



/* ===== RRHH - Empleados===== */
export type Employee = {
  id: number
  doc_id: string | null
  nombres: string
  apellidos: string
  email: string | null
  telefono: string | null
  position_id: number | null
  base_salary: number | null
  contract_type: string | null
  contract_start: string | null
  contract_end: string | null
  estado: "activo" | "inactivo"
  fecha_ingreso: string
}

// ===== RRHH / Nómina =====
export type PayrollPeriod = {
  id: number
  code: string
  start: string
  end: string
  is_closed: boolean
}

export type PayrollSummary = {
  period_id: number | null
  empleados: number
  bruto: number
  deducciones: number
  neto: number
}

export type Payslip = {
  id: number
  period_id: number
  emp_id: number
  doc_id: string | null
  empleado: string
  base_salary: number
  overtime: number
  bonus: number
  deductions: number
  net: number
  has_pdf?: boolean
}

// Periodos
export function usePayrollPeriods(limit = 24) {
  const [data, setData] = React.useState<PayrollPeriod[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const json = await getJSON<{items: PayrollPeriod[], total: number}>(`${API_BASE}/rrhh/nomina/periodos?limit=${limit}`)
      setData(json.items ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Error')
    } finally { setLoading(false) }
  }, [limit])

  React.useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}

// Resumen
export function usePayrollSummary(periodId?: number | null) {
  const [data, setData] = React.useState<PayrollSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const qs = periodId ? `?period_id=${periodId}` : ''
      const json = await getJSON<PayrollSummary>(`${API_BASE}/rrhh/nomina/resumen${qs}`)
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? 'Error')
    } finally { setLoading(false) }
  }, [periodId])

  React.useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}

// Boletas (paginado)
export function usePayslips({
  periodId,
  q,
  page,
  page_size,
}: {
  periodId?: number;
  q: string;
  page: number;
  page_size: number;
}) {
  const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1";
  const [data, setData] = React.useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(page_size),
    });
    if (periodId != null) params.set("period_id", String(periodId)); // <-- nombre correcto
    if (q) params.set("q", q);

    const res = await fetch(`${API}/rrhh/nomina/boletas?${params.toString()}`);
    const json = await res.json();
    setData({ items: json.items ?? [], total: json.total ?? 0 });
    setLoading(false);
  }, [periodId, q, page, page_size]); // <-- incluye periodId

  React.useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

/* =========================================
 * Dashboard: tipos
 * =======================================*/
// Le añadimos alias opcionales para que el UI no se queje aunque el backend use otros nombres
export type DashboardKpis = {
  ventas_mes?: number
  ventas_periodo?: number
  stock_total_kg?: number
  lotes_aprobados_pct?: number
  entregas_a_tiempo_pct?: number
  costo_produccion_mes?: number
  costo_produccion_periodo?: number
  nomina_mes?: number
  nomina_periodo?: number
  empleados_activos?: number
  delta_ventas_mes?: number
  delta_ventas?: number
  delta_lotes_aprobados?: number
  delta_entregas?: number
  delta_costo_produccion?: number
}

export type DashboardSeries = {
  ventas_por_mes: Array<{ ym: string; total: number }>
  stock_por_categoria: Array<{ categoria: string; kg: number }>
  tasa_aprobacion_calidad: Array<{ ym: string; pct: number }>
  top_productos_vendidos: Array<{ producto: string; qty: number }>

  // opcionales
  costos_por_mes?: Array<{ ym: string; total: number }>
  op_por_estado?: Array<{ estado: string; count: number }>
  stock_por_bodega?: Array<{ bodega: string; kg: number }>
  stock_por_estado?: Array<{ estado: string; kg: number }>
}

export type DashboardAlerts = {
  stock_bajo?: Array<{ name: string; qty: number; min_stock: number }>
  orden_produccion_atrasada?: Array<{ productionorder_id: number; code: string; due_date: string }>
  facturas_vencidas?: Array<{ invoice_id: number; number: string; due_date: string; total_amount: number }>
  lotes_pendientes_aprobacion?: Array<{ qualitytest_id: number; lot_id: number; test_date: string }>
}

export type DashboardResponse = {
  kpis: DashboardKpis
  series: DashboardSeries
  alertas: DashboardAlerts
}

export type DashboardMeta = {
  warehouses?: { id: number | string; code?: string; name: string }[]
  categories?: { id: number | string; name: string }[]
}

/* =========================================
 * Mocks
 * =======================================*/
const USE_MOCK_DASH = String(import.meta.env.VITE_MOCK_DASHBOARD ?? "") === "1"

const MOCK_META: DashboardMeta = {
  warehouses: [
    { id: 1, code: "ALM-01", name: "Almacén Central" },
    { id: 2, code: "ALM-02", name: "Secundario" },
  ],
  categories: [
    { id: "Arabica", name: "Arábica" },
    { id: "Robusta", name: "Robusta" },
    { id: "Geisha",  name: "Geisha"  },
    { id: "Bourbon", name: "Bourbon" },
  ],
}

const MOCK_OVERVIEW: DashboardResponse = {
  kpis: {
    ventas_mes: 8450,
    ventas_periodo: 8450,
    delta_ventas_mes: 12.5,
    delta_ventas: 12.5,
    stock_total_kg: 456,
    lotes_aprobados_pct: 50,
    entregas_a_tiempo_pct: 92.1,
    costo_produccion_mes: 1250,
    costo_produccion_periodo: 1250,
    nomina_mes: 0,
    nomina_periodo: 0,
    empleados_activos: 12,
  },
  series: {
    ventas_por_mes: [
      { ym: "2025-02", total: 4200 },
      { ym: "2025-03", total: 5600 },
      { ym: "2025-04", total: 6100 },
      { ym: "2025-05", total: 4800 },
      { ym: "2025-06", total: 7000 },
    ],
    costos_por_mes: [
      { ym: "2025-02", total: 2800 },
      { ym: "2025-03", total: 3600 },
      { ym: "2025-04", total: 3900 },
      { ym: "2025-05", total: 3100 },
      { ym: "2025-06", total: 4500 },
    ],
    stock_por_categoria: [
      { categoria: "Arábica",  kg: 120 },
      { categoria: "Robusta",  kg: 85  },
      { categoria: "Geisha",   kg: 100 },
      { categoria: "Bourbon",  kg: 60  },
      { categoria: "Typica",   kg: 40  },
      { categoria: "Caturra",  kg: 12  },
      { categoria: "Libérica", kg: 20  },
      { categoria: "Excelsa",  kg: 19  },
    ],
    stock_por_bodega: [
      { bodega: "Almacén Central", kg: 300 },
      { bodega: "Secundario",      kg: 156 },
    ],
    stock_por_estado: [
      { estado: "Materia Prima",      kg: 220 },
      { estado: "En Proceso",         kg: 110 },
      { estado: "Producto Terminado", kg: 126 },
    ],
    tasa_aprobacion_calidad: [
      { ym: "2025-02", pct: 48 },
      { ym: "2025-03", pct: 51 },
      { ym: "2025-04", pct: 49 },
      { ym: "2025-05", pct: 53 },
      { ym: "2025-06", pct: 50 },
    ],
    top_productos_vendidos: [
      { producto: "Café Arábica Premium", qty: 120 },
      { producto: "Café Molido Premium",  qty: 95  },
      { producto: "Café Tostado Arábica", qty: 60  },
      { producto: "Café Robusta",         qty: 45  },
      { producto: "Termo Café",           qty: 40  },
      { producto: "Prensa francesa",      qty: 28  },
      { producto: "Café Descafeinado",    qty: 24  },
      { producto: "Café Blend",           qty: 15  },
    ],
    op_por_estado: [
      { estado: "Planificada", count: 4 },
      { estado: "En Proceso",  count: 3 },
      { estado: "Retrasada",   count: 2 },
      { estado: "Completada",  count: 5 },
    ],
  },
  alertas: {
    stock_bajo: [
      { name: "Filtro Papel #4", qty: 12, min_stock: 50 },
      { name: "Molino manual",  qty: 3,  min_stock: 20 },
    ],
    orden_produccion_atrasada: [
      { productionorder_id: 101, code: "OP-101", due_date: "2025-09-20" },
    ],
    facturas_vencidas: [
      { invoice_id: 9001, number: "CAFE-T002", due_date: "2025-09-15", total_amount: 1530.5 },
    ],
    lotes_pendientes_aprobacion: [
      { qualitytest_id: 77, lot_id: 5021, test_date: "2025-09-18" },
    ],
  },
}

/* =========================================
 * Utils para mock/normalización
 * =======================================*/
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const sum = (arr: any[], key: string) => arr.reduce((a, b) => a + (Number(b?.[key]) || 0), 0)
const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const windowSizeByPeriod: Record<Period, number> = {
  week: 1,      // simulación simple
  month: 1,
  quarter: 3,
  year: 12,
}

const pctDelta = (curr: number, prev: number) => {
  const c = Number(curr) || 0
  const p = Number(prev) || 0
  if (p === 0) return c === 0 ? 0 : 100
  return ((c - p) / p) * 100
}

function normalizeOverview(json: DashboardResponse): DashboardResponse {
  // Aquí podrías mapear alias si el backend real usa otros nombres.
  return json
}

/* =========================================
 * Filtrado/calculado del MOCK
 * =======================================*/
function buildMockOverview(opts: { period: Period; warehouseId: string; category: string }): DashboardResponse {
  const { period, warehouseId, category } = opts
  const base = MOCK_OVERVIEW
  const view = clone(base)

  // 1) Ventana temporal (ventas / costos)
  const win = windowSizeByPeriod[period]
  const ventasAll = base.series.ventas_por_mes
  const costosAll = base.series.costos_por_mes ?? []
  const ventasWin = ventasAll.slice(-win)
  const ventasPrev = ventasAll.slice(-win * 2, -win)
  const costosWin = costosAll.slice(-win)
  const costosPrev = costosAll.slice(-win * 2, -win)

  view.series.ventas_por_mes = ventasWin
  if (view.series.costos_por_mes) view.series.costos_por_mes = costosWin

  // KPIs con la ventana
  const ventasSum = sum(ventasWin, "total")
  const ventasMes = ventasWin.at(-1)?.total ?? ventasSum
  const ventasPrevSum = sum(ventasPrev, "total")
  const ventasMesPrev = ventasPrev.at(-1)?.total ?? 0

  const costosSum = sum(costosWin, "total")
  const costosMes = costosWin.at(-1)?.total ?? costosSum
  const costosPrevSum = sum(costosPrev, "total")

  view.kpis.ventas_periodo = ventasSum
  view.kpis.ventas_mes = ventasMes
  view.kpis.delta_ventas = Number(pctDelta(ventasSum, ventasPrevSum).toFixed(1))
  view.kpis.delta_ventas_mes = Number(pctDelta(ventasMes, ventasMesPrev).toFixed(1))

  view.kpis.costo_produccion_periodo = costosSum
  view.kpis.costo_produccion_mes = costosMes
  view.kpis.delta_costo_produccion = Number(pctDelta(costosSum, costosPrevSum).toFixed(1))

  // 2) Filtro por almacén (escala proporcional para simular)
  if (warehouseId !== "all" && base.series.stock_por_bodega?.length) {
    const whMeta = MOCK_META.warehouses?.find(w => String(w.id) === String(warehouseId))
    const row = base.series.stock_por_bodega.find(b => norm(b.bodega) === norm(whMeta?.name))
    const totalStock = base.kpis.stock_total_kg || sum(base.series.stock_por_bodega, "kg")
    const whKg = row?.kg ?? 0
    const ratio = totalStock ? whKg / totalStock : 0

    view.kpis.stock_total_kg = Math.round(whKg)
    view.series.stock_por_bodega = base.series.stock_por_bodega.filter(b => norm(b.bodega) === norm(whMeta?.name))
    view.series.stock_por_categoria = view.series.stock_por_categoria.map(s => ({ ...s, kg: Math.round(s.kg * ratio) }))
    if (view.series.stock_por_estado)
      view.series.stock_por_estado = view.series.stock_por_estado.map(s => ({ ...s, kg: Math.round(s.kg * ratio) }))

    // “Ajuste” de ventas/costos por almacén para que se note
    view.series.ventas_por_mes = view.series.ventas_por_mes.map(v => ({ ...v, total: Math.round(v.total * (0.6 + ratio * 0.8)) }))
    if (view.series.costos_por_mes)
      view.series.costos_por_mes = view.series.costos_por_mes.map(v => ({ ...v, total: Math.round(v.total * (0.6 + ratio * 0.8)) }))
  }

  // 3) Filtro por categoría
  if (category !== "all") {
    const catName = MOCK_META.categories?.find(c => String(c.id) === String(category))?.name ?? category
    view.series.stock_por_categoria = (view.series.stock_por_categoria ?? []).filter(s => norm(s.categoria) === norm(catName))
    view.series.top_productos_vendidos = (view.series.top_productos_vendidos ?? []).filter(p => norm(p.producto).includes(norm(catName)))
  }

  return view
}

/* =========================================
 * API base y helpers genéricos
 * =======================================*/
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1"

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* =========================================
 * Hooks de catálogo
 * =======================================*/
export function useWarehouses() {
  const [data, setData] = React.useState<Warehouse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await getJSON<Warehouse[]>(`${API_BASE}/warehouses`))
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

export function useUoms() {
  const [data, setData] = React.useState<Uom[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await getJSON<Uom[]>(`${API_BASE}/uoms`))
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

export function useProducts(params?: { search?: string; category?: string }) {
  const [data, setData] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const search = params?.search?.trim() ?? ""
  const category = params?.category ?? "all"

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const qs = new URLSearchParams()
      if (search) qs.set("search", search)
      if (category !== "all") qs.set("category", category)
      setData(await getJSON<Product[]>(`${API_BASE}/products?${qs.toString()}`))
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [search, category])

  React.useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

/* =========================================
 * RRHH / Empleados (paginado)
 * =======================================*/
export function useEmployees(params: {
  q?: string
  page: number
  page_size: number
  estado?: "activo" | "inactivo"
}) {
  const { q = "", page, page_size, estado } = params

  const [data, setData] = React.useState<Page<Employee>>({
    items: [],
    total: 0,
    page,
    page_size,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const qs = new URLSearchParams()
      if (q.trim()) qs.set("q", q.trim())
      if (estado) qs.set("estado", estado)
      qs.set("page", String(page))
      qs.set("page_size", String(page_size))

      const json = await getJSON<Page<Employee>>(`${API_BASE}/rrhh/empleados?${qs.toString()}`)
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [q, estado, page, page_size])

  React.useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}

/* =========================================
 * Dashboard: Meta y Overview (con mock filtrable)
 * =======================================*/
export function useDashboardMeta() {
  const [data, setData] = React.useState<DashboardMeta | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<unknown>(null)

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setError(null)
        if (USE_MOCK_DASH) {
          // Simulamos pequeña latencia
          await new Promise(r => setTimeout(r, 100))
          setData(MOCK_META)
        } else {
          const res = await fetch(`/api/v1/dashboard/meta`, { headers: { Accept: "application/json" } })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          setData(await res.json())
        }
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return { data, loading, error }
}

export function useDashboardOverview(params: {
  period: Period
  warehouseId?: string
  category?: string
}) {
  const { period, warehouseId = "all", category = "all" } = params

  const [data, setData] = React.useState<DashboardResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  const buildQS = React.useCallback(() => {
    const qs = new URLSearchParams()
    qs.set("period", period)
    if (warehouseId && warehouseId !== "all") qs.set("warehouse", warehouseId)
    if (category && category !== "all") qs.set("category", category)
    return qs.toString()
  }, [period, warehouseId, category])

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (USE_MOCK_DASH) {
        // Mock con filtros aplicados y KPIs recalculados
        await new Promise(r => setTimeout(r, 120)) // pequeña latencia opcional
        setData(buildMockOverview({ period, warehouseId, category }))
        return
      }

      const qs = buildQS()
      const res = await fetch(`/api/v1/dashboard/overview?${qs}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as DashboardResponse
      setData(normalizeOverview(json))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [buildQS, period, warehouseId, category])

  React.useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}




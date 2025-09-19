// src/hooks/useCafetalApi.ts
import * as React from 'react'
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

/* ===== RRHH ===== */
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

/* ===== DASHBOARD ===== */
export type DashboardKpis = {
  ventas_mes?: number;
  stock_total_kg?: number;
  lotes_aprobados_pct?: number;
  entregas_a_tiempo_pct?: number;
  costo_produccion_mes?: number;
  nomina_mes?: number;

  // deltas opcionales (si el backend no los manda, quedan undefined)
  delta_ventas_mes?: number;
  delta_lotes_aprobados?: number;
  delta_entregas?: number;
  delta_costo_produccion?: number;
};

export type DashboardSeries = {
  ventas_por_mes: Array<{ ym: string; total: number }>;
  stock_por_categoria: Array<{ categoria: string; kg: number }>;
  tasa_aprobacion_calidad: Array<{ ym: string; pct: number }>;
  top_productos_vendidos: Array<{ producto: string; qty: number }>;
};

export type DashboardAlerts = {
  stock_bajo?: Array<{ name: string; qty: number; min_stock: number }>;
  orden_produccion_atrasada?: Array<{ productionorder_id: number; code: string; due_date: string }>;
  facturas_vencidas?: Array<{ invoice_id: number; number: string; due_date: string; total_amount: number }>;
  lotes_pendientes_aprobacion?: Array<{ qualitytest_id: number; lot_id: number; test_date: string }>;
};
export type DashboardResponse = {
  kpis: DashboardKpis;
  series: DashboardSeries;
  alertas: DashboardAlerts;
};

export function useDashboardMeta() {
  const [state, setState] = React.useState({ data:null, loading:true, error:null as unknown });
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/meta', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setState({ data: await res.json(), loading:false, error:null });
      } catch (e) { setState({ data:null, loading:false, error:e }); }
    })();
  }, []);
  return state; // {data:{warehouses, categories}, loading, error}
}

type Params = {
  period: "week" | "month" | "quarter" | "year"
  warehouseId?: string // "all" | "1" | "2" | ...
  category?: string    // "all" | "verde" | ...
}

type OverviewResponse = {
  kpis: Record<string, any>
  series: Record<string, any[]>
  alertas?: Record<string, any[]>
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8080/api/v1'

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// -------- Warehouses --------
export function useWarehouses() {
  const [data, setData] = React.useState<Warehouse[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true); setError(null)
      setData(await getJSON<Warehouse[]>(`${API_BASE}/warehouses`))
    } catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}

// -------- UOMs --------
export function useUoms() {
  const [data, setData] = React.useState<Uom[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true); setError(null)
      setData(await getJSON<Uom[]>(`${API_BASE}/uoms`))
    } catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setLoading(false) }
  }, [])

  React.useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}

// -------- Products (filtros server-side) --------
export function useProducts(params?: { search?: string; category?: string }) {
  const [data, setData] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const search = params?.search?.trim() ?? ''
  const category = params?.category ?? 'all'

  const refetch = React.useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (category !== 'all') qs.set('category', category)
      setData(await getJSON<Product[]>(`${API_BASE}/products?${qs.toString()}`))
    } catch (e: any) { setError(e?.message ?? 'Error desconocido') }
    finally { setLoading(false) }
  }, [search, category])

  React.useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}


 // RRHH / Empleados (paginado + búsqueda)

export function useEmployees(params: {
  q?: string
  page: number
  page_size: number
  estado?: "activo" | "inactivo"   // <- NUEVO (opcional)
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
      if (estado)  qs.set("estado", estado)     // <- NUEVO
      qs.set("page", String(page))
      qs.set("page_size", String(page_size))

      const json = await getJSON<Page<Employee>>(
        `${API_BASE}/rrhh/empleados?${qs.toString()}`
      )
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [q, estado, page, page_size])               // <- estado en deps

  React.useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
  
}

//Dashboard
export function useDashboardOverview(params: Params) {
  const [data, setData] = React.useState<OverviewResponse | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<unknown>(null)

  const buildQS = React.useCallback(() => {
    const qs = new URLSearchParams()
    qs.set("period", params.period)
    if (params.warehouseId && params.warehouseId !== "all") qs.set("warehouse", params.warehouseId)
    if (params.category && params.category !== "all") qs.set("category", params.category)
    return qs.toString()
  }, [params.period, params.warehouseId, params.category])

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const qs = buildQS()
      const res = await fetch(`/api/v1/dashboard/overview?${qs}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as OverviewResponse
      setData(json)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [buildQS])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}


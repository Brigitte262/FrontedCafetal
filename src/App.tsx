import * as React from 'react'
import { AppLayout } from './components/app-layout'
import { ThemeProvider } from './hooks/use-theme'
import { Toaster } from './components/ui/sonner'
import { Dashboard } from './app/dashboard'
import { OrdenesProduccion } from './app/produccion/ordenes'
import { GestionLotes } from './app/produccion/lotes'
import { ControlCalidad } from './app/produccion/calidad'
import { GestionInventario } from './app/logistica/inventario'
import { KardexMovimientos } from './app/logistica/kardex'
import { GestionFacturas } from './app/finanzas/facturas'
import  GestionEmpleados  from './app/rrhh/empleados'
import NominaPage from './app/rrhh/Nomina'

// Simple router state management
type Route = 
  | '/app/dashboard'
  | '/app/produccion/ordenes'
  | '/app/produccion/lotes'
  | '/app/produccion/calidad'
  | '/app/logistica/inventario'
  | '/app/logistica/kardex'
  | '/app/logistica/envios'
  | '/app/finanzas/ventas'
  | '/app/finanzas/compras'
  | '/app/finanzas/facturas'
  | '/app/finanzas/pagos'
  | '/app/finanzas/costos'
  | '/app/rrhh/empleados'
  | '/app/rrhh/nomina'
  | '/app/config/catalogos'

function useRouter() {
  const [currentRoute, setCurrentRoute] = React.useState<Route>('/app/dashboard')

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as Route
      if (hash) {
        setCurrentRoute(hash)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange() // Check initial hash

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = (route: Route) => {
    window.location.hash = route
    setCurrentRoute(route)
  }

  return { currentRoute, navigate }
}

// Route configuration
const routes = {
  '/app/dashboard': {
    component: Dashboard,
    breadcrumbs: [{ label: 'Dashboard' }],
    title: 'Dashboard Gerencial'
  },
  '/app/produccion/ordenes': {
    component: OrdenesProduccion,
    breadcrumbs: [
      { label: 'Producción', href: '/app/produccion' },
      { label: 'Órdenes de Producción' }
    ],
    title: 'Órdenes de Producción'
  },
  '/app/produccion/lotes': {
    component: GestionLotes,
    breadcrumbs: [
      { label: 'Producción', href: '/app/produccion' },
      { label: 'Gestión de Lotes' }
    ],
    title: 'Gestión de Lotes'
  },
  '/app/produccion/calidad': {
    component: ControlCalidad,
    breadcrumbs: [
      { label: 'Producción', href: '/app/produccion' },
      { label: 'Control de Calidad' }
    ],
    title: 'Control de Calidad'
  },
  '/app/logistica/inventario': {
    component: GestionInventario,
    breadcrumbs: [
      { label: 'Logística', href: '/app/logistica' },
      { label: 'Inventario' }
    ],
    title: 'Gestión de Inventario'
  },
  '/app/logistica/kardex': {
    component: KardexMovimientos,
    breadcrumbs: [
      { label: 'Logística', href: '/app/logistica' },
      { label: 'Kardex' }
    ],
    title: 'Kardex de Movimientos'
  },
  '/app/finanzas/facturas': {
    component: GestionFacturas,
    breadcrumbs: [
      { label: 'Finanzas', href: '/app/finanzas' },
      { label: 'Facturas' }
    ],
    title: 'Gestión de Facturas'
  },
  '/app/rrhh/empleados': {
    component: GestionEmpleados,
    breadcrumbs: [
      { label: 'Recursos Humanos', href: '/app/rrhh' },
      { label: 'Empleados' }
    ],
    title: 'Gestión de Empleados'
  },
  '/app/rrhh/nomina': {
    component: NominaPage,
    breadcrumbs: [
      { label: 'Recursos Humanos', href: '/app/rrhh' },
      { label: 'Nómina' }
    ],
    title: 'Nómina'
  }
}

// Placeholder component for unimplemented routes
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
      <div className="text-6xl">🚧</div>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">Esta funcionalidad estará disponible próximamente</p>
    </div>
  )
}

export default function App() {
  const { currentRoute } = useRouter()

  React.useEffect(() => {
    // Update href attributes for navigation
    const updateNavLinks = () => {
      const links = document.querySelectorAll('a[href^="/app/"]')
      links.forEach(link => {
        const href = link.getAttribute('href')
        if (href) {
          link.addEventListener('click', (e) => {
            e.preventDefault()
            window.location.hash = href
          })
        }
      })
    }

    updateNavLinks()
  }, [currentRoute])

  const routeConfig = routes[currentRoute as keyof typeof routes]

  const renderContent = () => {
    if (routeConfig) {
      const Component = routeConfig.component
      return <Component />
    }

    // Handle unimplemented routes
    const routeTitles: Record<Route, string> = {
      '/app/dashboard': 'Dashboard',
      '/app/produccion/ordenes': 'Órdenes de Producción',
      '/app/produccion/lotes': 'Gestión de Lotes',
      '/app/produccion/calidad': 'Control de Calidad',
      '/app/logistica/inventario': 'Inventario',
      '/app/logistica/kardex': 'Kardex',
      '/app/logistica/envios': 'Envíos y Distribución',
      '/app/finanzas/ventas': 'Gestión de Ventas',
      '/app/finanzas/compras': 'Gestión de Compras',
      '/app/finanzas/facturas': 'Facturación',
      '/app/finanzas/pagos': 'Gestión de Pagos',
      '/app/finanzas/costos': 'Costos y Rentabilidad',
      '/app/rrhh/empleados': 'Gestión de Empleados',
      '/app/rrhh/nomina': 'Nómina',
      '/app/config/catalogos': 'Catálogos'
    }

    return <ComingSoon title={routeTitles[currentRoute] || 'Funcionalidad'} />
  }

  const getBreadcrumbs = () => {
    if (routeConfig) {
      return routeConfig.breadcrumbs
    }
    
    // Generate breadcrumbs from route
    const parts = currentRoute.split('/').filter(Boolean)
    return parts.map((part, index) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1),
      href: index < parts.length - 1 ? `/${parts.slice(0, index + 1).join('/')}` : undefined
    }))
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="cafetal-theme">
      <AppLayout
        currentPath={currentRoute}
        breadcrumbs={getBreadcrumbs()}
        title={routeConfig?.title}
      >
        {renderContent()}
      </AppLayout>
      <Toaster />
    </ThemeProvider>
  )
}
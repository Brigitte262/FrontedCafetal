import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DataTable } from "@/components/data-table";
import { Users, CheckCircle2, XCircle, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmployeeStatus } from "@/lib/types";
import { useEmployees } from "@/hooks/useCafetalApi";

type Row = {
  id: number;
  doc_id: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  position_id: number | null;
  base_salary: number | null;
  fecha_ingreso: string;
  estado: "activo" | "inactivo";
};

const PAGE_SIZE = 10;

// ---- pequeño hook de debounce ----
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function initials(first?: string, last?: string) {
  const a = (first?.[0] ?? "").toUpperCase();
  const b = (last?.[0] ?? "").toUpperCase();
  return (a + b) || "E";
}

export default function GestionEmpleados() {
  // Filtros & paginación (server-side)
  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState<"todos" | "activo" | "inactivo">("todos");
  const [page, setPage] = React.useState(1);

  // debounce al query
  const qDebounced = useDebounced(q, 350);

  // columnas visibles (client-side)
  const [visible, setVisible] = React.useState({
    doc_id: true,
    telefono: true,
    position_id: true,
    base_salary: true,
    fecha_ingreso: true,
    estado: true,
  });

  // fetch (confía en el backend para estado; si es "todos", no manda el parámetro)
  const { data, loading, error, refetch } = useEmployees({
    q: qDebounced,
    page,
    page_size: PAGE_SIZE,
    estado: estado === "todos" ? undefined : estado,
  });

  // filas: usa tal cual lo que venga; si por algo tu backend aún NO filtra por estado,
  // se deja el fallback client-side:
  const rows: Row[] = React.useMemo(() => {
    const items = (data?.items ?? []) as Row[];
    if (estado === "todos") return items;
    // fallback si no filtró el backend
    return items.filter((r) => r.estado === estado);
  }, [data?.items, estado]);

  // columnas (dinámicas según `visible`)
  const columns = React.useMemo<ColumnDef<Row>[]>(() => {
    const cols: ColumnDef<Row>[] = [
      {
        id: "empleado",
        header: "Empleado",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials(r.nombres, r.apellidos)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{r.nombres} {r.apellidos}</div>
                <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
              </div>
            </div>
          );
        },
      },
    ];

    if (visible.doc_id) {
      cols.push({ accessorKey: "doc_id", header: "Documento" });
    }
    if (visible.telefono) {
      cols.push({
        accessorKey: "telefono",
        header: "Teléfono",
        cell: ({ row }) => row.original.telefono ?? "—",
      });
    }
    if (visible.position_id) {
      cols.push({
        accessorKey: "position_id",
        header: "Puesto (ID)",
        cell: ({ row }) => row.original.position_id ?? "—",
      });
    }
    if (visible.base_salary) {
      cols.push({
        accessorKey: "base_salary",
        header: "Salario",
        cell: ({ row }) =>
          row.original.base_salary == null ? "—" : formatCurrency(row.original.base_salary, "PEN"),
      });
    }
    if (visible.fecha_ingreso) {
      cols.push({
        accessorKey: "fecha_ingreso",
        header: "Fecha Ingreso",
        cell: ({ row }) => formatDate(row.original.fecha_ingreso),
      });
    }
    if (visible.estado) {
      cols.push({
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.estado === "activo" ? EmployeeStatus.ACTIVE : EmployeeStatus.INACTIVE}
          />
        ),
      });
    }
    return cols;
  }, [visible]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggle = (key: keyof typeof visible) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  // exportar TODOS los empleados en PDF (paginado)
 const exportPDF = async () => {
  const all: Row[] = [];

  // Paleta local (no toca nada global)
  const BRAND = {
    primary: [122, 30, 58] as [number, number, number],  // vino #7A1E3A
    accent:  [240, 228, 233] as [number, number, number],// #F0E4E9
    text:    [40, 40, 40]   as [number, number, number],
    zebra:   [252, 248, 249] as [number, number, number],
  };

  // 👉 Acepta string | null | undefined
  const cleanPhone = (t?: string | null): string =>
    t ? String(t).replace(/\s*\n\s*/g, " ") : "—";

  try {
    const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1";

    // Traer todas las páginas
    const fetchPage = async (pg: number) => {
      const qs = new URLSearchParams({
        page: String(pg),
        page_size: "100",
        ...(qDebounced ? { q: qDebounced } : {}),
        ...(estado !== "todos" ? { estado } : {}),
      });
      const res = await fetch(`${base}/rrhh/empleados?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      all.push(...(json.items as Row[]));
      const pages = Math.ceil(Number(json.total || 0) / 100);
      if (pg < pages) await fetchPage(pg + 1);
    };
    await fetchPage(1);

    // helpers
    const money = (v: any) =>
      `S/ ${Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-PE") : "—");

    // PDF
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezados según columnas visibles
    const head = [[
      "Empleado",
      ...(visible.doc_id ? ["Documento"] : []),
      ...(visible.telefono ? ["Teléfono"] : []),
      ...(visible.position_id ? ["Puesto (ID)"] : []),
      ...(visible.base_salary ? ["Salario"] : []),
      ...(visible.fecha_ingreso ? ["Fecha Ingreso"] : []),
      ...(visible.estado ? ["Estado"] : []),
    ]];

    // Filas
    const body = all.map((r) => ([
      `${r.nombres} ${r.apellidos}${r.email ? `\n${r.email}` : ""}`,
      ...(visible.doc_id ? [r.doc_id ?? "—"] : []),
      ...(visible.telefono ? [cleanPhone(r.telefono)] : []),   // ✅ sin error de tipos
      ...(visible.position_id ? [r.position_id ?? "—"] : []),
      ...(visible.base_salary ? [r.base_salary == null ? "—" : money(r.base_salary)] : []),
      ...(visible.fecha_ingreso ? [fdate(r.fecha_ingreso)] : []),
      ...(visible.estado ? [(r.estado ?? "ACTIVO").toUpperCase()] : []),
    ]));

    // Helper: índice de columna por etiqueta
    const idx = (label: string) => head[0].indexOf(label);

    // Columnas angostas con ancho fijo; “Empleado” toma el resto
    const columnStyles: Record<number, any> = {};
    if (idx("Documento") > -1)     columnStyles[idx("Documento")]     = { cellWidth: 80,  halign: "center" };
    if (idx("Teléfono") > -1)      columnStyles[idx("Teléfono")]      = { cellWidth: 80, halign: "center", overflow: "linebreak" };
    if (idx("Puesto (ID)") > -1)   columnStyles[idx("Puesto (ID)")]   = { cellWidth: 75,  halign: "center" };
    if (idx("Salario") > -1)       columnStyles[idx("Salario")]       = { cellWidth: 90,  halign: "right"  };
    if (idx("Fecha Ingreso") > -1) columnStyles[idx("Fecha Ingreso")] = { cellWidth: 80,  halign: "center" };
    if (idx("Estado") > -1)        columnStyles[idx("Estado")]        = { cellWidth: 60,  halign: "center", fontStyle: "bold" };
    columnStyles[0] = { overflow: "linebreak" }; // Empleado ocupa el resto

    autoTable(doc, {
      startY: 84,
      head,
      body,
      styles: {
        fontSize: 9,
        // ❌ lineHeight no existe; usa padding y valign para aire
        cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
        textColor: BRAND.text as any,
        lineColor: [230, 230, 230],
        lineWidth: 0.4,
        valign: "middle",
      },
      headStyles: {
        fillColor: BRAND.primary as any,
        textColor: 255,
        fontStyle: "bold",
        minCellHeight: 20,
      },
      alternateRowStyles: { fillColor: BRAND.zebra as any },
      columnStyles,
      margin: { left: 24, right: 24, top: 84, bottom: 28 },
      tableWidth: pageWidth - 48, // respeta márgenes

      didDrawPage: (data) => {
        // Header vino
        doc.setFillColor(...BRAND.primary);
        doc.rect(0, 0, pageWidth, 46, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text("CAFETAL SAC", 24, 28);
        doc.setFontSize(10);
        doc.text("Empleados", pageWidth - 24, 28, { align: "right" });

        // Subtítulo/acento
        doc.setFillColor(...BRAND.accent);
        doc.rect(0, 46, pageWidth, 18, "F");
        doc.setTextColor(...BRAND.text);
        doc.setFontSize(11);
        doc.text("Listado de empleados", 24, 58);

        // Footer / página
        const pageNo = (doc as any).getCurrentPageInfo().pageNumber;
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        doc.text(`Página ${pageNo}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      },

      didParseCell: (ctx) => {
        // Un poco más alto para “Empleado” (suele llevar email)
        if (ctx.section === "body" && ctx.column.index === 0) {
          ctx.cell.styles.minCellHeight = 22;
        }
      },
    });

    doc.save("empleados.pdf");
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar. Revisa la consola.");
  }
};



  const activos = rows.filter((r) => r.estado === "activo").length;
  const inactivos = rows.filter((r) => r.estado === "inactivo").length;

  return (
    <div className="rrhh-empleados space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Directorio Operativo del Equipo Cafetal</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPDF}>Exportar</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Columnas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem checked={visible.doc_id} onCheckedChange={() => toggle("doc_id")}>
                Documento
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visible.telefono} onCheckedChange={() => toggle("telefono")}>
                Teléfono
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visible.position_id} onCheckedChange={() => toggle("position_id")}>
                Puesto (ID)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visible.base_salary} onCheckedChange={() => toggle("base_salary")}>
                Salario
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visible.fecha_ingreso} onCheckedChange={() => toggle("fecha_ingreso")}>
                Fecha Ingreso
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visible.estado} onCheckedChange={() => toggle("estado")}>
                Estado
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none
                       ring-offset-background placeholder:text-muted-foreground
                       focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Buscar por nombre, apellido, email o doc…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={estado}
          onChange={(e) => { setEstado(e.target.value as any); setPage(1); }}
        >
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>

        <Button variant="secondary" onClick={() => refetch()} disabled={loading}>
          Refrescar
        </Button>

        {/* Paginación arriba */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
            Anterior
          </Button>
          <span className="text-muted-foreground">Página {page} / {totalPages}</span>
          <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
            Siguiente
          </Button>
        </div>
      </div>

      <Card
        className="
          rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10
          shadow-[0_8px_24px_rgba(0,0,0,.08)]
          hover:shadow-[0_20px_60px_rgba(0,0,0,.16)]
          transition-shadow duration-300
        "
      >
        <CardHeader>
          <CardTitle>Empleados</CardTitle>
        </CardHeader>

        {/* KPIs rápidos */}
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-gradient-to-br from-sky-50 to-sky-100/40 p-4 dark:from-sky-950/50 dark:to-sky-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Total registros</div>
                  <div className="mt-1 text-2xl font-semibold">{total}</div>
                </div>
                <div className="rounded-full bg-sky-100 p-2 dark:bg-sky-900/50">
                  <Users className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-4 dark:from-emerald-950/50 dark:to-emerald-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">En esta página (activos)</div>
                  <div className="mt-1 text-2xl font-semibold">{activos}</div>
                </div>
                <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-amber-100/40 p-4 dark:from-amber-950/50 dark:to-amber-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">En esta página (inactivos)</div>
                  <div className="mt-1 text-2xl font-semibold">{inactivos}</div>
                </div>
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/50">
                  <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent>
          {error && (
            <p className="text-sm text-destructive">
              {typeof error === "string" ? error : (error as Error)?.message ?? "Error"}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <DataTable
              className="[&_.dt-toolbar]:hidden [&_.dt-pagination]:hidden"
              columns={columns}
              data={rows}
              enableSelection={false}
            />
          )}

          {/* Footer de paginación con rango */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {rows.length
                ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} de ${total.toLocaleString()}`
                : "—"}
            </div>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






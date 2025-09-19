import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import jsPDF from "jspdf";
import { DataTable } from "@/components/data-table";
import { Users, CheckCircle2, XCircle, LayoutGrid } from "lucide-react";


import autoTable from "jspdf-autotable";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const pageSize = 10;

  // columnas visibles (client-side)
  const [visible, setVisible] = React.useState({
    doc_id: true,
    telefono: true,
    position_id: true,
    base_salary: true,
    fecha_ingreso: true,
    estado: true,
  });

  // fetch
  const { data, loading, error, refetch } = useEmployees({
    q,
    page,
    page_size: pageSize,
    estado: estado === "todos" ? undefined : estado, // si tu API acepta ?estado=
  });

  // cuando cambian filtros/página, el hook ya refetchea; aquí solo reseteo a página 1 al buscar
  const onSearchChange = (v: string) => {
    setQ(v);
    setPage(1);
  };

  // rows para la tabla (y filtro client-side por estado si el backend aún no lo filtra)
  const rows: Row[] = React.useMemo(() => {
    const items = (data?.items ?? []) as Row[];
    if (estado === "todos") return items;
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
        cell: ({ row }) => row.original.base_salary == null ? "—" : formatCurrency(row.original.base_salary, "PEN"),
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

  // total páginas
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / pageSize));

  // toggle columnas
  const toggle = (key: keyof typeof visible) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  // exportar TODOS los empleados en PDF (recorriendo páginas)
  const exportPDF = async () => {
    const all: Row[] = [];
    try {
      // trae todas las páginas (respetando el filtro q/estado)
      const fetchPage = async (pg: number) => {
        const qs = new URLSearchParams({
          page: String(pg),
          page_size: "100", // página grande para exportar
          ...(q ? { q } : {}),
          ...(estado !== "todos" ? { estado } : {}),
        });
        const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1"}/rrhh/empleados?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        all.push(...(json.items as Row[]));
        const total = Number(json.total || 0);
        const pages = Math.ceil(total / 100);
        if (pg < pages) await fetchPage(pg + 1);
      };
      await fetchPage(1);

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Empleados", 40, 40);

      autoTable(doc, {
        startY: 60,
        head: [[
          "Empleado",
          ...(visible.doc_id ? ["Documento"] : []),
          ...(visible.telefono ? ["Teléfono"] : []),
          ...(visible.position_id ? ["Puesto (ID)"] : []),
          ...(visible.base_salary ? ["Salario"] : []),
          ...(visible.fecha_ingreso ? ["Fecha Ingreso"] : []),
          ...(visible.estado ? ["Estado"] : []),
        ]],
        body: all.map((r) => ([
          `${r.nombres} ${r.apellidos} ${r.email ? `\n${r.email}` : ""}`,
          ...(visible.doc_id ? [r.doc_id ?? "—"] : []),
          ...(visible.telefono ? [r.telefono ?? "—"] : []),
          ...(visible.position_id ? [r.position_id ?? "—"] : []),
          ...(visible.base_salary ? [r.base_salary == null ? "—" : formatCurrency(r.base_salary, "PEN")] : []),
          ...(visible.fecha_ingreso ? [formatDate(r.fecha_ingreso)] : []),
          ...(visible.estado ? [r.estado.toUpperCase()] : []),
        ])),
        styles: { fontSize: 9, cellPadding: 6, lineWidth: 0.2 },
        headStyles: { fillColor: [34, 197, 94] }, // verde sutil
        didDrawPage: (d) => {
          const page = doc.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${page}`, d.settings.margin.left, doc.internal.pageSize.height - 10);
        },
      });

      doc.save("empleados.pdf");
    } catch (e) {
      console.error(e);
      alert("No se pudo exportar. Revisa la consola.");
    }
  };

  const total = data?.total ?? 0;
const activos = rows.filter(r => r.estado === "activo").length;
const inactivos = rows.filter(r => r.estado === "inactivo").length;
const paginaInfo = `${page} / ${totalPages}`;

  return (
    <div className="rrhh-empleados space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de Empleados</h1>
        <div className="flex items-center gap-2">
          {/* Exportar */}
          <Button variant="outline" onClick={exportPDF}>Exportar</Button>

          {/* Columnas */}
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
  {/* 🔹 envoltorio con flex-1 para que se estire */}
  <div className="flex-1 min-w-[280px]">
    <input
      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none
                 ring-offset-background placeholder:text-muted-foreground
                 focus-visible:ring-2 focus-visible:ring-ring"
      placeholder="Buscar por nombre, apellido, email o doc…"
      value={q}
      onChange={(e) => onSearchChange(e.target.value)}
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

  {/* Paginación arriba (queda a la derecha) */}
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

      <Card>
        <CardHeader>
          <CardTitle>Empleados</CardTitle>
        </CardHeader>

        {/* KPIs rápidos */}
<div className="mx-auto max-w-6xl">
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {/* Total registros */}
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

    {/* Activos (página) */}
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

    {/* Inactivos (página) */}
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
        </CardContent>
      </Card>
    </div>
  );
}





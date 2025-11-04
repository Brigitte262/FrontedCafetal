import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { jsPDF } from "jspdf";
import autoTable, { HookData, CellHookData } from "jspdf-autotable";
import { DataTable } from "@/components/data-table";
import { Users, CheckCircle2, XCircle, Search, Pencil, Trash2, Plus } from "lucide-react";
import { createPortal } from "react-dom";


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

function useConfirm() {
  type Cfg = {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    resolver: (v: boolean) => void;
    tone?: "default" | "danger";
  };
  const [cfg, setCfg] = React.useState<Cfg | null>(null);

  const confirm = (o: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: "default" | "danger";
  }) =>
    new Promise<boolean>((resolve) => {
      setCfg({
        open: true,
        title: o.title ?? "Confirmar",
        message: o.message,
        confirmText: o.confirmText ?? "Confirmar",
        cancelText: o.cancelText ?? "Cancelar",
        resolver: resolve,
        tone: o.tone ?? "default",
      });
    });

  const close = (val: boolean) => {
    if (cfg) cfg.resolver(val);
    setCfg(null);
  };

  const DialogUI = !cfg?.open ? null : (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center rounded-2xl justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => close(false)}
      onKeyDown={(e) => e.key === "Escape" && close(false)}
    >
      <div
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-[44rem]
  rounded-2xl overflow-hidden  bg-background p-6
  border border-black/5 ring-1 ring-black/15
  shadow-[0_35px_120px_-20px_rgba(0,0,0,0.60),_0_18px_48px_rgba(0,0,0,0.35)]
  max-h-[65vh] overflow-y-auto relative
  before:content-[''] before:absolute before:-inset-3 before:-z-10 before:rounded-[1.25rem]
  before:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22),transparent_60%)]"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h3 className="text-base text-center font-semibold">{cfg.title}</h3>
        <p className="text-sm text-muted-foreground text-center">
          {cfg.message}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-4 shrink-0" 
            onClick={() => close(false)}
          >
            {cfg.cancelText}
          </Button>

          <Button
            size="sm"
            variant={cfg.tone === "danger" ? "destructive" : "default"}
            className="h-9 px-4 shrink-0"
            onClick={() => close(true)}
          >
            {cfg.confirmText}
          </Button>
        </div>
      </div>
    </div>
  );

  // ⬇️ Esto hace que el diálogo se pinte por fuera del modal (encima de todo)
  const ConfirmDialog =
    typeof window !== "undefined"
      ? createPortal(DialogUI, document.body)
      : null;

  return { confirm, ConfirmDialog };
}

export { useConfirm };

export default function GestionEmpleados() {
  // Filtros & paginación (server-side)
  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState<"todos" | "activo" | "inactivo">("todos");
  const [page, setPage] = React.useState(1);
  const { confirm, ConfirmDialog } = useConfirm();

  // Modales + formularios (editar / crear)
  const [editOpen, setEditOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    id: 0,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    base_salary: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });
  const [createForm, setCreateForm] = React.useState({
    doc_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hire_date: "",
    base_salary: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    position_id: "" as string | "",
  });
  const [selectedRow, setSelectedRow] = React.useState<Row | null>(null);

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

  // filas
  const rows: Row[] = React.useMemo(() => {
    const items = (data?.items ?? []) as Row[];
    if (estado === "todos") return items;
    return items.filter((r) => r.estado === estado);
  }, [data?.items, estado]);

  // Base URL backend
  const apiBase = React.useMemo(() => (
    import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1"
  ), []);

  // Handlers Edición
  const openEdit = (r: Row) => {
    setSelectedRow(r);
    setEditForm({
      id: r.id,
      first_name: r.nombres || "",
      last_name: r.apellidos || "",
      email: r.email || "",
      phone: r.telefono || "",
      base_salary: r.base_salary == null ? "" : String(r.base_salary),
      status: r.estado === "activo" ? "ACTIVE" : "INACTIVE",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
  const ok = await confirm({
    title: "Confirmar cambios",
    message: "¿Está seguro que quiere cambiar los datos del empleado?",
    confirmText: "Sí, guardar",
    cancelText: "Cancelar",
  });
  if (!ok) return;

  setSaving(true);
  try {
    const payload: Record<string, unknown> = {};
    if (editForm.first_name) payload.first_name = editForm.first_name;
    if (editForm.last_name)  payload.last_name  = editForm.last_name;
    payload.email = editForm.email || null;
    payload.phone = editForm.phone || null;
    if (editForm.base_salary !== "") payload.base_salary = Number(editForm.base_salary);
    if (editForm.status) payload.status = editForm.status;

    const res = await fetch(`${apiBase}/rrhh/empleados/${editForm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      throw new Error(err?.detail || `HTTP ${res.status}`);
    }

    setEditOpen(false);
    await refetch();
  } catch (e: any) {
    alert(`Error al guardar: ${e?.message || e}`);
  } finally {
    setSaving(false);
  }
};

  const onDelete = async (r: Row) => {
  const ok = await confirm({
    title: "Eliminar empleado",
    message: `¿Desea eliminar el registro de ${r.nombres} ${r.apellidos}?`,
    confirmText: "Sí, eliminar",
    cancelText: "Cancelar",
    tone: "danger",
  });
  if (!ok) return;

  try {
    const res = await fetch(`${apiBase}/rrhh/empleados/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      throw new Error(err?.detail || `HTTP ${res.status}`);
    }
    await refetch();
  } catch (e: any) {
    alert(`No se pudo eliminar: ${e?.message || e}`);
  }
};

  // Handlers Crear
  const openCreate = () => {
    setCreateForm({
      doc_id: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      hire_date: "",
      base_salary: "",
      status: "ACTIVE",
      position_id: "",
    });
    setCreateOpen(true);
  };

  const saveCreate = async () => {
  setSaving(true);
  try {
    const body = {
      doc_id: createForm.doc_id,
      first_name: createForm.first_name,
      last_name: createForm.last_name,
      email: createForm.email || null,
      phone: createForm.phone || null,
      hire_date: createForm.hire_date || null, // "YYYY-MM-DD"
      // ⬇️ MANDAR LOS FALTANTES AUNQUE SEAN NULL
      position_id: null,                        // o Number(createForm.position_id) si lo pides
      base_salary: createForm.base_salary === "" ? null : Number(createForm.base_salary),
      status: createForm.status,
      contract_type: null,
      contract_start: null,
      contract_end: null,
    };

    const res = await fetch(`${apiBase}/rrhh/empleados`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any));
      throw new Error(err?.detail || `HTTP ${res.status}`);
    }
    setCreateOpen(false);
    await refetch();
  } catch (e: any) {
    alert(`No se pudo crear: ${e?.message || e}`);
  } finally {
    setSaving(false);
  }
};


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

    // 👉 Acciones (siempre visible)
    cols.push({
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(row.original)}>
            <Trash2 className="mr-1 h-4 w-4" /> Eliminar
          </Button>
        </div>
      ),
    });

    return cols;
  }, [visible]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggle = (key: keyof typeof visible) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  // exportar TODOS los empleados en PDF (paginado)
  const exportPDF = async () => {
    const all: Row[] = [];

    const BRAND = {
      primary: [122, 30, 58] as [number, number, number],
      accent:  [240, 228, 233] as [number, number, number],
      text:    [40, 40, 40]   as [number, number, number],
      zebra:   [252, 248, 249] as [number, number, number],
    };

    const cleanPhone = (t?: string | null): string =>
      t ? String(t).replace(/\s*\n\s*/g, " ") : "—";

    try {
      const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080/api/v1";

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

      const money = (v: any) =>
        `S/ ${Number(v ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-PE") : "—");

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      const head = [[
        "Empleado",
        ...(visible.doc_id ? ["Documento"] : []),
        ...(visible.telefono ? ["Teléfono"] : []),
        ...(visible.position_id ? ["Puesto (ID)"] : []),
        ...(visible.base_salary ? ["Salario"] : []),
        ...(visible.fecha_ingreso ? ["Fecha Ingreso"] : []),
        ...(visible.estado ? ["Estado"] : []),
      ]];

      const body = all.map((r) => ([
        `${r.nombres} ${r.apellidos}${r.email ? `\n${r.email}` : ""}`,
        ...(visible.doc_id ? [r.doc_id ?? "—"] : []),
        ...(visible.telefono ? [cleanPhone(r.telefono)] : []),
        ...(visible.position_id ? [r.position_id ?? "—"] : []),
        ...(visible.base_salary ? [r.base_salary == null ? "—" : money(r.base_salary)] : []),
        ...(visible.fecha_ingreso ? [fdate(r.fecha_ingreso)] : []),
        ...(visible.estado ? [(r.estado ?? "ACTIVO").toUpperCase()] : []),
      ]));

      const idx = (label: string) => head[0].indexOf(label);

      const columnStyles: Record<number, any> = {};
      if (idx("Documento") > -1)     columnStyles[idx("Documento")]     = { cellWidth: 80,  halign: "center" };
      if (idx("Teléfono") > -1)      columnStyles[idx("Teléfono")]      = { cellWidth: 80, halign: "center", overflow: "linebreak" };
      if (idx("Puesto (ID)") > -1)   columnStyles[idx("Puesto (ID)")]   = { cellWidth: 75,  halign: "center" };
      if (idx("Salario") > -1)       columnStyles[idx("Salario")]       = { cellWidth: 90,  halign: "right"  };
      if (idx("Fecha Ingreso") > -1) columnStyles[idx("Fecha Ingreso")] = { cellWidth: 80,  halign: "center" };
      if (idx("Estado") > -1)        columnStyles[idx("Estado")]        = { cellWidth: 60,  halign: "center", fontStyle: "bold" };
      columnStyles[0] = { overflow: "linebreak" };

      autoTable(doc, {
        startY: 84,
        head,
        body,
        styles: {
          fontSize: 9,
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
        tableWidth: pageWidth - 48,

        didDrawPage: (data: HookData) => {
          doc.setFillColor(...BRAND.primary);
          doc.rect(0, 0, pageWidth, 46, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.text("CAFETAL SAC", 24, 28);
          doc.setFontSize(10);
          doc.text("Empleados", pageWidth - 24, 28, { align: "right" });

          doc.setFillColor(...BRAND.accent);
          doc.rect(0, 46, pageWidth, 18, "F");
          doc.setTextColor(...BRAND.text);
          doc.setFontSize(11);
          doc.text("Listado de empleados", 24, 58);

          const pageNo = (doc as any).getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.setTextColor(140, 140, 140);
          doc.text(`Página ${pageNo}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        },

        didParseCell: (ctx: CellHookData) => {
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
        <h1 className="text-2xl font-semibold">
          Directorio Operativo del Equipo Cafetal
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportPDF}>
            Exportar
          </Button>
          {/* 👉 Botón Crear Empleado (fuera de la tabla) */}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Crear empleado
          </Button>
          <DropdownMenu>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem
                checked={visible.doc_id}
                onCheckedChange={() => toggle("doc_id")}
              >
                Documento
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visible.telefono}
                onCheckedChange={() => toggle("telefono")}
              >
                Teléfono
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visible.position_id}
                onCheckedChange={() => toggle("position_id")}
              >
                Puesto (ID)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visible.base_salary}
                onCheckedChange={() => toggle("base_salary")}
              >
                Salario
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visible.fecha_ingreso}
                onCheckedChange={() => toggle("fecha_ingreso")}
              >
                Fecha Ingreso
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={visible.estado}
                onCheckedChange={() => toggle("estado")}
              >
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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>

        <Button
          variant="secondary"
          onClick={() => refetch()}
          disabled={loading}
        >
          Refrescar
        </Button>

        {/* Paginación arriba */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
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
                  <div className="text-xs text-muted-foreground">
                    Total registros
                  </div>
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
                  <div className="text-xs text-muted-foreground">
                    En esta página (activos)
                  </div>
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
                  <div className="text-xs text-muted-foreground">
                    En esta página (inactivos)
                  </div>
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
              {typeof error === "string"
                ? error
                : (error as Error)?.message ?? "Error"}
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
                ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${
                    (page - 1) * PAGE_SIZE + rows.length
                  } de ${total.toLocaleString()}`
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Modal Editar ---- */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="
      w-full sm:max-w-lg md:max-w-xl lg:max-w-[46rem]    
      rounded-2xl bg-background p-6
      border border-black/5 ring-1 ring-black/15
      shadow-[0_35px_120px_-20px_rgba(0,0,0,0.60),_0_18px_48px_rgba(0,0,0,0.35)]
      max-h-[85vh] overflow-y-auto relative
      before:content-[''] before:absolute before:-inset-3 before:-z-10 before:rounded-[1.25rem]
      before:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22),transparent_60%)]
      "
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Editar empleado</h3>
              <p className="text-xs text-muted-foreground">ID #{editForm.id}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Nombres
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Apellidos
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Email
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Teléfono
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Salario base
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={editForm.base_salary}
                  onChange={(e) =>
                    setEditForm({ ...editForm, base_salary: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Estado
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as any })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal Crear ---- */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className="
      w-full sm:max-w-lg md:max-w-xl lg:max-w-[46rem]    
      rounded-2xl bg-background p-6
      border border-black/5 ring-1 ring-black/15
      shadow-[0_35px_120px_-20px_rgba(0,0,0,0.60),_0_18px_48px_rgba(0,0,0,0.35)]
      max-h-[85vh] overflow-y-auto relative
      before:content-[''] before:absolute before:-inset-3 before:-z-10 before:rounded-[1.25rem]
      before:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.22),transparent_60%)]
      "
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Crear empleado</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Documento
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.doc_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, doc_id: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Fecha ingreso
                <input
                  type="date"
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.hire_date}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, hire_date: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Nombres
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, first_name: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Apellidos
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, last_name: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Email
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Teléfono
                <input
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, phone: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                Salario base
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 h-9 w-full rounded-md border px-3 text-sm"
                  value={createForm.base_salary}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      base_salary: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Estado
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      status: e.target.value as any,
                    })
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveCreate} disabled={saving}>
                {saving ? "Creando…" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}






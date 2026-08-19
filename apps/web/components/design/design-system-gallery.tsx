'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  MapSkeleton,
  NavbarLink,
  PriorityBadge,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { radii, recipes, shadows, space, typeHierarchy, typography } from '@/lib/design-tokens';

const COPY = {
  sq: {
    tokens: 'Vlerat e fiksuara',
    type: 'Tipografi',
    spacing: 'Hapësira',
    radius: 'Këndet',
    shadows: 'Hijet',
    buttons: 'Butonat',
    navbar: 'Shiriti i navigimit',
    inputs: 'Fushat',
    cards: 'Kartat',
    badges: 'Etiketat',
    dialogs: 'Dialogët',
    dropdowns: 'Menytë',
    tabs: 'Skedat',
    tables: 'Tabelat',
    toasts: 'Njoftimet',
    tooltips: 'Ndihmësat',
    skeletons: 'Skeletet',
    primary: 'Kryesor',
    secondary: 'Dytësor',
    ghost: 'Ghost',
    destructive: 'Shkatërrues',
    loading: 'Duke u ngarkuar',
    openDialog: 'Hap dialogun',
    openConfirm: 'Hap konfirmimin',
    dialogTitle: 'Ndrysho statusin',
    dialogBody: 'Raporti kalon te Në progres. Qytetari njoftohet.',
    confirmTitle: 'Fshi sesionet?',
    confirmBody: 'Dalja nga të gjitha pajisjet e tjera. Ky veprim nuk kthehet.',
    menu: 'Hap menynë',
    assign: 'Cakto',
    archive: 'Arkivo',
    toast: 'Shfaq njoftim',
    tooltip: 'Kaloni këtu',
    tooltipBody: 'SLA 48 orë për dëmtim rruge.',
    name: 'Emri',
    category: 'Kategoria',
    notes: 'Shënime',
    tabOpen: 'Hapura',
    tabResolved: 'Të zgjidhura',
    colId: 'ID',
    colStatus: 'Statusi',
    colSla: 'SLA',
  },
  en: {
    tokens: 'Locked values',
    type: 'Typography',
    spacing: 'Spacing',
    radius: 'Radius',
    shadows: 'Shadows',
    buttons: 'Buttons',
    navbar: 'Navbar',
    inputs: 'Inputs',
    cards: 'Cards',
    badges: 'Badges',
    dialogs: 'Dialogs',
    dropdowns: 'Dropdowns',
    tabs: 'Tabs',
    tables: 'Tables',
    toasts: 'Toasts',
    tooltips: 'Tooltips',
    skeletons: 'Skeletons',
    primary: 'Primary',
    secondary: 'Secondary',
    ghost: 'Ghost',
    destructive: 'Destructive',
    loading: 'Loading',
    openDialog: 'Open dialog',
    openConfirm: 'Open confirm',
    dialogTitle: 'Update status',
    dialogBody: 'This report moves to In progress. The citizen is notified.',
    confirmTitle: 'Sign out other sessions?',
    confirmBody: 'You will be signed out everywhere else. This cannot be undone.',
    menu: 'Open menu',
    assign: 'Assign',
    archive: 'Archive',
    toast: 'Show toast',
    tooltip: 'Hover here',
    tooltipBody: '48-hour SLA for road damage.',
    name: 'Name',
    category: 'Category',
    notes: 'Notes',
    tabOpen: 'Open',
    tabResolved: 'Resolved',
    colId: 'ID',
    colStatus: 'Status',
    colSla: 'SLA',
  },
} as const;

function Specimen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-label font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function DesignSystemGallery({ locale }: { locale: 'sq' | 'en' }) {
  const t = COPY[locale];
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-section">
        <Specimen title={t.tokens}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-inset">
              <p className="text-label text-muted-foreground">{t.type}</p>
              <ul className="mt-cluster space-y-3">
                {typeHierarchy.map((row) => {
                  const spec = typography[row.token];
                  const isDisplay = spec.family === 'Fraunces';
                  return (
                    <li key={row.name}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={
                            isDisplay ? 'font-display text-foreground' : 'font-sans text-foreground'
                          }
                          style={{
                            fontSize: spec.size,
                            lineHeight: spec.lineHeight,
                            fontWeight: spec.weight,
                            letterSpacing: spec.letterSpacing,
                          }}
                        >
                          {row.name}
                        </span>
                        <span className="shrink-0 text-right font-mono text-caption text-muted-foreground">
                          {isDisplay ? 'serif' : 'sans'} · {spec.size}
                        </span>
                      </div>
                      <p className="mt-0.5 text-caption text-muted-foreground">{row.use}</p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-cluster text-caption text-muted-foreground">
                {recipes.type.display}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-inset">
              <p className="text-label text-muted-foreground">{t.spacing}</p>
              <ul className="mt-cluster space-y-3">
                {(
                  [
                    ['cluster', space.cluster],
                    ['gutter', space.gutter],
                    ['inset', space.inset],
                    ['stack', space.stack],
                    ['section', space.section],
                  ] as const
                ).map(([name, value]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{name}</span>
                      <span className="font-mono text-caption text-muted-foreground">{value}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-sm bg-mosque-200" style={{ width: value }} />
                  </li>
                ))}
              </ul>
              <p className="mt-stack text-caption text-muted-foreground">{recipes.space.section}</p>
            </div>
            <div className="space-y-stack">
              <div className="rounded-lg border border-border bg-card p-inset">
                <p className="text-label text-muted-foreground">{t.radius}</p>
                <div className="mt-cluster grid grid-cols-2 gap-cluster">
                  {(
                    [
                      ['sm', radii.sm],
                      ['md', radii.md],
                      ['lg', radii.lg],
                      ['xl', radii.xl],
                    ] as const
                  ).map(([name, value]) => (
                    <div key={name} className="text-center">
                      <div
                        className="h-12 border border-border bg-muted"
                        style={{ borderRadius: value }}
                      />
                      <p className="mt-1 text-caption text-muted-foreground">
                        {name} · {value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-cluster text-caption text-muted-foreground">
                  control {recipes.radius.control} · nested {recipes.radius.nested} · surface{' '}
                  {recipes.radius.surface}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-inset">
                <p className="text-label text-muted-foreground">{t.shadows}</p>
                <div className="mt-cluster grid grid-cols-3 gap-cluster">
                  {(
                    [
                      ['sm', shadows.sm],
                      ['soft', shadows.md],
                      ['lift', shadows.lg],
                    ] as const
                  ).map(([name, value]) => (
                    <div
                      key={name}
                      className="rounded-lg bg-card p-3 text-center text-caption"
                      style={{ boxShadow: value }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Specimen>

        <Specimen title={t.buttons}>
          <div className="flex flex-wrap items-center gap-cluster">
            <Button>{t.primary}</Button>
            <Button variant="secondary">{t.secondary}</Button>
            <Button variant="ghost">{t.ghost}</Button>
            <Button variant="destructive">{t.destructive}</Button>
            <Button size="sm">{t.primary} sm</Button>
            <Button size="lg">{t.primary} lg</Button>
            <Button loading>{t.loading}</Button>
          </div>
        </Specimen>

        <Specimen title={t.navbar}>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card px-gutter py-2">
            <NavbarLink href="#specimen" active>
              Raportet
            </NavbarLink>
            <NavbarLink href="#specimen">Transparenca</NavbarLink>
            <NavbarLink href="#specimen">Si funksionon</NavbarLink>
            <Button size="sm" className="ml-2">
              Raporto një problem
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">{recipes.nav.cta}</p>
        </Specimen>

        <Specimen title={t.inputs}>
          <div className="grid gap-gutter sm:grid-cols-2">
            <div>
              <Label htmlFor="ds-name">{t.name}</Label>
              <Input id="ds-name" defaultValue="Gent Krasniqi" />
            </div>
            <div>
              <Label htmlFor="ds-cat">{t.category}</Label>
              <Select id="ds-cat" defaultValue="roads">
                <option value="roads">Dëmtim rruge</option>
                <option value="lights">Ndriçim</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ds-notes">{t.notes}</Label>
              <Textarea id="ds-notes" rows={3} defaultValue="Gropa pranë Shadërvanit." />
            </div>
            <div>
              <Label htmlFor="ds-invalid">{t.name}</Label>
              <Input id="ds-invalid" invalid defaultValue="" />
            </div>
          </div>
        </Specimen>

        <Specimen title={t.cards}>
          <Card>
            <CardHeader
              title={locale === 'sq' ? 'Raporti PRZ-2026-000184' : 'Report PRZ-2026-000184'}
              description={
                locale === 'sq' ? 'Dëmtim rruge · Rruga Shadërvan' : 'Road damage · Shadërvan'
              }
            />
            <CardBody>
              <p className="text-sm text-muted-foreground">
                {locale === 'sq'
                  ? 'Kartat janë letra, jo xham. Këndi xl, hija sm, titulli h3.'
                  : 'Cards are paper, not glass. Radius xl, shadow sm, title h3.'}
              </p>
            </CardBody>
          </Card>
        </Specimen>

        <Specimen title={t.badges}>
          <div className="flex flex-wrap items-center gap-cluster">
            <StatusBadge status="SUBMITTED" />
            <StatusBadge status="RECEIVED" />
            <StatusBadge status="UNDER_REVIEW" />
            <StatusBadge status="ASSIGNED" />
            <StatusBadge status="IN_PROGRESS" />
            <StatusBadge status="WAITING_FOR_INFORMATION" />
            <StatusBadge status="RESOLVED" />
            <StatusBadge status="REJECTED" />
            <StatusBadge status="DUPLICATE" />
            <PriorityBadge priority="CRITICAL" />
            <Badge tone="info">Komuna</Badge>
          </div>
        </Specimen>

        <Specimen title={t.dialogs}>
          <div className="flex flex-wrap gap-cluster">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">{t.openDialog}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.dialogTitle}</DialogTitle>
                  <DialogDescription>{t.dialogBody}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary">{t.ghost}</Button>
                  <Button>{t.primary}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              {t.openConfirm}
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t.confirmTitle}
              description={t.confirmBody}
              tone="destructive"
              onConfirm={() => setConfirmOpen(false)}
            />
          </div>
        </Specimen>

        <Specimen title={t.dropdowns}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">{t.menu}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>{t.assign}</DropdownMenuItem>
              <DropdownMenuItem>{t.archive}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t.destructive}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Specimen>

        <Specimen title={t.tabs}>
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">{t.tabOpen}</TabsTrigger>
              <TabsTrigger value="resolved">{t.tabResolved}</TabsTrigger>
            </TabsList>
            <TabsContent value="open">
              <p className="text-sm text-muted-foreground">128</p>
            </TabsContent>
            <TabsContent value="resolved">
              <p className="text-sm text-muted-foreground">64</p>
            </TabsContent>
          </Tabs>
        </Specimen>

        <Specimen title={t.tables}>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.colId}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colSla}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-caption">000184</TableCell>
                  <TableCell>
                    <StatusBadge status="IN_PROGRESS" />
                  </TableCell>
                  <TableCell>
                    <Badge tone="warning">due soon</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-caption">000185</TableCell>
                  <TableCell>
                    <StatusBadge status="RESOLVED" />
                  </TableCell>
                  <TableCell>
                    <Badge tone="success">on time</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Specimen>

        <Specimen title={t.toasts}>
          <Button
            variant="secondary"
            onClick={() => toast.success(locale === 'sq' ? 'Statusi u ruajt.' : 'Status saved.')}
          >
            {t.toast}
          </Button>
        </Specimen>

        <Specimen title={t.tooltips}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary">{t.tooltip}</Button>
            </TooltipTrigger>
            <TooltipContent>{t.tooltipBody}</TooltipContent>
          </Tooltip>
        </Specimen>

        <Specimen title={t.skeletons}>
          <div className="grid gap-gutter sm:grid-cols-2">
            <div className="space-y-cluster rounded-xl border border-border bg-card p-inset">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <MapSkeleton className="h-40 rounded-xl border border-border" />
          </div>
        </Specimen>
      </div>
    </TooltipProvider>
  );
}

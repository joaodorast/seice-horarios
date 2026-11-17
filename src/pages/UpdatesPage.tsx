import { useState } from 'react';
import { ArrowRight, History, Search, Sparkles } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { Button, ButtonLink, Input } from '@/components/ui';
import { updateHistory } from '@/lib/updateNews';
import { matches } from '@/lib/text';

export function UpdatesPage() {
  const [search, setSearch] = useState('');
  const releases = updateHistory.map((release) => ({ ...release, items: matches([release.title, release.description], search) ? release.items : release.items.filter((item) => matches([item.title, item.description], search)) })).filter((release) => release.items.length);
  return <Page title="Atualizações" breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Atualizações' }]} description="Veja o que melhorou no SEICE e acesse as telas atualizadas. Este histórico fica sempre disponível aqui.">
    <div className="space-y-6">
      <section className="flex items-start gap-4 rounded-2xl border border-line-strong bg-brand-soft p-5 sm:p-6"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand"><History className="size-6" /></span><div><h2 className="text-xl font-bold">As novidades continuam aqui</h2><p className="mt-2 text-base leading-relaxed text-ink-2">Fechou o aviso de atualização? Sem problema. Consulte as melhorias registradas abaixo e use os botões para abrir cada tela.</p></div></section>
      <div className="rounded-2xl border border-line bg-surface p-5"><label htmlFor="updates-search" className="mb-2 block text-base font-bold">O que você quer encontrar?</label><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" /><Input id="updates-search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Ex.: professores, regências ou cadastro" className="h-12 pl-12 text-base" /></div><p role="status" className="mt-3 text-base text-muted">{releases.length} {releases.length===1?'publicação encontrada':'publicações encontradas'}</p></div>
      {releases.map((release)=><article key={release.id} className="overflow-hidden rounded-2xl border border-line-strong bg-surface" aria-labelledby={`${release.id}-title`}>
        <header className="border-b border-line bg-subtle/60 p-5 sm:p-6"><div className="mb-3 flex flex-wrap items-center gap-3"><time dateTime={release.date} className="text-base font-semibold text-ink-2">{new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(`${release.date}T12:00:00Z`))}</time>{release.id===updateHistory[0].id&&<span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-sm font-bold"><Sparkles className="size-4" />Mais recente</span>}</div><h2 id={`${release.id}-title`} className="text-2xl font-bold">{release.title}</h2><p className="mt-2 text-base leading-relaxed text-ink-2">{release.description}</p></header>
        <ul className="divide-y divide-line">{release.items.map((item)=><li key={item.title} className="p-5 sm:p-6"><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-2 text-base leading-relaxed text-ink-2">{item.description}</p><div className="mt-4 flex flex-wrap gap-3">{item.links.filter((link)=>link.to!=='/atualizacoes').map((link)=><ButtonLink key={link.to} to={link.to} className="h-auto min-h-11 whitespace-normal py-2 text-base" icon={<ArrowRight className="size-4 shrink-0" />}>{link.label}</ButtonLink>)}</div></li>)}</ul>
      </article>)}
      {!releases.length&&<section className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center"><h2 className="text-xl font-bold">Nenhuma atualização encontrada</h2><p className="mt-2 text-base text-muted">Tente outra palavra ou veja todas as novidades.</p><Button className="mt-4" onClick={()=>setSearch('')}>Limpar pesquisa</Button></section>}
    </div>
  </Page>;
}

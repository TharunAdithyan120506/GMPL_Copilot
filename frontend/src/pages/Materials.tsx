import { useState } from 'react';
import api from '../utils/api';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { MaterialRepository } from '../repositories/material.repository';
import { db } from '../lib/db';
import { SkeletonTable, FreshnessLabel } from '../components/Skeleton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';

interface RawMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  allocatedQty?: number;
  availableQty?: number;
}

export function Materials() {
  const { isOnline } = useSyncStatus();
  const { toast } = useToast();

  // ── Cache-first: reads IndexedDB instantly, background-refreshes from server ──
  const { data: materials, isFirstLoad, lastSyncedAt, refresh } = useLiveQuery(
    () => MaterialRepository.getAll() as any,
    (force) => MaterialRepository.refresh(force),
    db.materials as any,
    'materials',
  );

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', unit: 'kg' });
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({ code: '', name: '', unit: 'kg' });
    setShowModal(true);
  };

  const openEditModal = (material: RawMaterial) => {
    setEditingMaterial(material);
    setFormData({ code: material.code, name: material.name, unit: material.unit });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingMaterial) {
        await api.patch(`/raw-materials/${editingMaterial.id}`, { name: formData.name, unit: formData.unit });
        toast.success(`Material "${formData.name}" updated.`);
      } else {
        await api.post('/raw-materials', formData);
        toast.success(`Material "${formData.name}" created.`);
      }
      setShowModal(false);
      setEditingMaterial(null);
      setFormData({ code: '', name: '', unit: 'kg' });
      refresh();
    } catch (err) {
      toast.error('Error saving material. The code may already exist.');
    } finally { setSaving(false); }
  };

  const filteredMaterials = (materials as RawMaterial[]).filter(m =>
    m.code.toLowerCase().includes(search.toLowerCase()) ||
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 p-margin min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 pb-6 border-b-4 border-on-background border-dashed">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-background uppercase tracking-tight">Raw Material Inventory</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">Manage stock levels, allocations, and reorder points for all production polymers.</p>
          <FreshnessLabel lastSyncedAt={lastSyncedAt} isOnline={isOnline} className="mt-1" />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input
              className="w-full sm:w-64 pl-10 pr-4 py-3 bg-surface border-2 border-on-background font-body-md text-body-md placeholder:text-on-surface-variant focus:outline-none focus:ring-0 focus:shadow-[4px_4px_0px_#1A1A1A] transition-shadow"
              placeholder="Search Materials..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={openCreateModal} className="bg-primary-container text-on-primary-container font-headline-md text-[18px] py-3 px-8 border-2 border-on-background shadow-[6px_6px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0px_#1A1A1A] transition-all flex items-center justify-center gap-2 uppercase whitespace-nowrap">
            <span className="material-symbols-outlined fill-icon">add_box</span>
            New Material
          </button>
        </div>
      </div>

      {isFirstLoad ? (
        <SkeletonTable cols={5} rows={6} />
      ) : filteredMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant bg-surface border-2 border-on-background">
          <span className="material-symbols-outlined text-[56px]">inventory_2</span>
          <p className="font-body-md text-body-md">No materials found.</p>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredMaterials.map(mat => (
              <div key={mat.id} className="bg-surface border-2 border-on-background neo-shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-data-md text-data-md font-bold text-on-background">{mat.code}</div>
                    <div className="font-body-md text-body-md text-on-surface-variant">{mat.name}</div>
                  </div>
                  <button onClick={() => openEditModal(mat)} className="shrink-0 bg-surface-variant text-on-background border-2 border-on-background px-3 py-1 neo-shadow-sm font-label-sm text-label-sm uppercase hover:neo-active">
                    Edit
                  </button>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t-2 border-on-background">
                  <div><span className="font-label-sm text-label-sm text-on-surface-variant block">Available</span><span className="font-data-md text-data-md">{Number(mat.availableQty || 0).toLocaleString()} {mat.unit}</span></div>
                  <div><span className="font-label-sm text-label-sm text-on-surface-variant block">Allocated</span><span className="font-data-md text-data-md text-secondary">{Number(mat.allocatedQty || 0).toLocaleString()} {mat.unit}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block bg-surface border-2 border-on-background neo-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-surface-variant border-b-2 border-on-background">
                  <tr>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Code & Name</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest text-right">Available</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest text-right">Allocated</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest">Status</th>
                    <th className="p-4 font-label-sm text-label-sm text-on-background uppercase tracking-widest text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-on-background">
                  {filteredMaterials.map(mat => (
                    <tr key={mat.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4"><div className="font-bold">{mat.code}</div><div className="text-secondary text-sm">{mat.name}</div></td>
                      <td className="p-4 font-data-md text-data-md text-right">{Number(mat.availableQty || 0).toLocaleString()}</td>
                      <td className="p-4 font-data-md text-data-md text-right text-secondary">{Number(mat.allocatedQty || 0).toLocaleString()}</td>
                      <td className="p-4"><span className="border-2 border-on-background bg-surface-variant px-2 py-1 font-label-sm text-label-sm uppercase">Tracked</span></td>
                      <td className="p-4 text-center">
                        <button onClick={() => openEditModal(mat)} className="bg-surface-variant text-on-background border-2 border-on-background px-3 py-1 neo-shadow-sm font-label-sm text-label-sm uppercase hover:neo-active">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-2 border-on-background bg-error-container text-danger hover:bg-danger hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h2 className="font-display-lg text-[24px] uppercase border-b-2 border-on-background pb-2 mb-6">
              {editingMaterial ? 'Edit Raw Material' : 'New Raw Material'}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Code</label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData(prev => ({...prev, code: e.target.value}))}
                  disabled={!!editingMaterial}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]"
                />
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]"
                />
              </div>
              <div>
                <label className="font-label-sm uppercase text-secondary block mb-1">Unit</label>
                <input
                  required
                  type="text"
                  value={formData.unit}
                  onChange={e => setFormData(prev => ({...prev, unit: e.target.value}))}
                  className="w-full bg-surface-container-low border-2 border-on-background p-3 focus:outline-none focus:shadow-[4px_4px_0px_#1A1A1A]"
                />
              </div>
              <button disabled={saving} type="submit" className="mt-4 bg-primary text-on-primary border-2 border-on-background p-3 uppercase font-bold neo-shadow-sm hover:neo-active disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {editingMaterial ? 'Save Material' : 'Create Material'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

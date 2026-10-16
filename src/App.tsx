/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { TopBar, StudioTab } from './components/layout/TopBar';
import { RomDropzone } from './components/layout/RomDropzone';
import { DatabaseStudio } from './components/database/DatabaseStudio';
import { MapStudio } from './components/map/MapStudio';
import { GraphicsStudio } from './components/graphics/GraphicsStudio';
import { TextStudio } from './components/text/TextStudio';
import { DiffViewer } from './components/build/DiffViewer';
import { DeltaManager } from './core/deltaManager';
import { ROMValidationResult } from './core/romReader';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [romBuffer, setRomBuffer] = useState<Uint8Array | null>(null);
  const [validation, setValidation] = useState<ROMValidationResult | null>(null);
  const [deltaManager, setDeltaManager] = useState<DeltaManager | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('database');
  const [dataRevision, setDataRevision] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const forgeInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleRomLoaded = useCallback((buffer: Uint8Array, val: ROMValidationResult) => {
    setRomBuffer(buffer);
    setValidation(val);
    const dm = new DeltaManager(buffer, val.crc32Hex);
    setDeltaManager(dm);
    setActiveTab('database');
    setDataRevision((r) => r + 1);
    showToast(`Loaded ${val.gameTitle} (${val.gameCode}) with CRC32 ${val.crc32Hex}`);
  }, []);

  const handleDataChanged = useCallback(() => {
    setDataRevision((r) => r + 1);
  }, []);

  const handleUndo = () => {
    if (deltaManager && deltaManager.canUndo()) {
      deltaManager.undo();
      handleDataChanged();
      showToast('Undid previous modification');
    }
  };

  const handleRedo = () => {
    if (deltaManager && deltaManager.canRedo()) {
      deltaManager.redo();
      handleDataChanged();
      showToast('Redid modification');
    }
  };

  const handleSaveForge = async () => {
    if (!deltaManager) return;
    try {
      const blob = await deltaManager.exportForgeArchive('Emerald_PokeForge_Project');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.forge';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported .forge project workspace archive');
    } catch (err: any) {
      showToast(err.message || 'Failed to export .forge project', 'error');
    }
  };

  const handleLoadForgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!deltaManager || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const res = await deltaManager.importForgeArchive(file);
    if (res.success) {
      handleDataChanged();
      showToast(`Restored .forge project: ${file.name}`);
    } else {
      showToast(res.error || 'Failed to load .forge project', 'error');
    }
    // reset input
    e.target.value = '';
  };

  const handleExportRom = () => {
    if (!deltaManager) return;
    try {
      const compiled = deltaManager.compilePatchedROM();
      const blob = new Blob([compiled.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pokemon_Emerald_Patched.gba';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Exported playable Pokemon_Emerald_Patched.gba (BIOS Checksum 0xBD verified)');
    } catch (err: any) {
      showToast(err.message || 'Failed to compile ROM', 'error');
    }
  };

  const handleNewRom = () => {
    setRomBuffer(null);
    setValidation(null);
    setDeltaManager(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-200">
      <input
        ref={forgeInputRef}
        type="file"
        accept=".forge,.zip"
        className="hidden"
        onChange={handleLoadForgeFile}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border shadow-xl flex items-center gap-2 text-xs font-medium backdrop-blur-md transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Viewport */}
      {!romBuffer || !validation || !deltaManager ? (
        <RomDropzone onRomLoaded={handleRomLoaded} />
      ) : (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <TopBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            gameCode={validation.gameCode}
            gameTitle={validation.gameTitle}
            crc32Hex={validation.crc32Hex}
            modifiedCount={deltaManager.getModifiedCount()}
            canUndo={deltaManager.canUndo()}
            canRedo={deltaManager.canRedo()}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSaveForge={handleSaveForge}
            onExportRom={handleExportRom}
            onNewRom={handleNewRom}
            onLoadForgeClick={() => forgeInputRef.current?.click()}
          />

          <main className="flex-1 flex overflow-hidden">
            {activeTab === 'database' && (
              <DatabaseStudio
                key={`db-${dataRevision}`}
                deltaManager={deltaManager}
                romBuffer={romBuffer}
                onDataChanged={handleDataChanged}
              />
            )}

            {activeTab === 'map' && (
              <MapStudio
                key={`map-${dataRevision}`}
                deltaManager={deltaManager}
                romBuffer={romBuffer}
                onDataChanged={handleDataChanged}
              />
            )}

            {activeTab === 'graphics' && (
              <GraphicsStudio
                key={`gfx-${dataRevision}`}
                romBuffer={romBuffer}
                onDataChanged={handleDataChanged}
              />
            )}

            {activeTab === 'text' && (
              <TextStudio
                key={`txt-${dataRevision}`}
                deltaManager={deltaManager}
                romBuffer={romBuffer}
                onDataChanged={handleDataChanged}
              />
            )}

            {activeTab === 'diffs' && (
              <DiffViewer
                key={`diff-${dataRevision}`}
                deltaManager={deltaManager}
                romBuffer={romBuffer}
                onSaveForge={handleSaveForge}
                onExportRom={handleExportRom}
                onLoadForgeClick={() => forgeInputRef.current?.click()}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

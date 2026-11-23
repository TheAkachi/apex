import { useRef, type ChangeEvent } from 'react';
import { Bell, Download, RotateCcw, Sparkles, Upload } from 'lucide-react';
import type { NotificationStatus } from '../../services/notifications';
import type { ApexSettings } from '../../types/models';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: ApexSettings;
  brownNoiseOn: boolean;
  notificationStatus: NotificationStatus;
  hasRealBackup: boolean;
  onUpdateSettings: (partial: Partial<ApexSettings>) => void;
  onToggleBrownNoise: (next: boolean) => void;
  onBrownNoiseVolumeChange: (vol: number) => void;
  onRequestNotifications: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onLoadDemoData: () => void;
  onExitDemoData: () => void;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  brownNoiseOn,
  notificationStatus,
  hasRealBackup,
  onUpdateSettings,
  onToggleBrownNoise,
  onBrownNoiseVolumeChange,
  onRequestNotifications,
  onExportBackup,
  onImportBackup,
  onLoadDemoData,
  onExitDemoData,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  const notifLabel =
    notificationStatus === 'granted'
      ? 'Ativadas no navegador'
      : notificationStatus === 'denied'
        ? 'Bloqueadas nas permissões do navegador'
        : notificationStatus === 'unsupported'
          ? 'Não suportadas neste navegador'
          : 'Aguardando permissão';

  return (
    <Modal open={open} onClose={onClose} title="Configurações & Dados">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Iniciar descanso automaticamente</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Começa o cronômetro de descanso assim que a atividade termina.
            </div>
          </div>
          <Toggle
            checked={settings.autoStartBreak}
            onChange={(next) => onUpdateSettings({ autoStartBreak: next })}
            ariaLabel="Iniciar descanso automaticamente"
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Concluir pendências automaticamente
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Marca a pendência como resolvida assim que o horário de término passa.
            </div>
          </div>
          <Toggle
            checked={settings.autoCompleteExpiredEvents}
            onChange={(next) => onUpdateSettings({ autoCompleteExpiredEvents: next })}
            ariaLabel="Concluir pendências automaticamente após o horário"
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Alertas sonoros</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              Toca um aviso suave ao fim do timer e nos lembretes do calendário.
            </div>
          </div>
          <Toggle
            checked={settings.soundEnabled}
            onChange={(next) => onUpdateSettings({ soundEnabled: next })}
            ariaLabel="Ativar ou desativar alertas sonoros"
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Ruído marrom</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                Som ambiente suave opcional (também acessível pelo ícone de som no topo).
              </div>
            </div>
            <Toggle
              checked={brownNoiseOn}
              onChange={onToggleBrownNoise}
              ariaLabel="Ativar ou desativar ruído marrom"
            />
          </div>
          {brownNoiseOn && (
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={settings.brownNoiseVolume}
              onChange={(e) => onBrownNoiseVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
              aria-label="Volume do ruído marrom"
            />
          )}
        </div>

        <div
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Notificações do sistema</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{notifLabel}</div>
          </div>
          {notificationStatus === 'default' && (
            <button type="button" className="btn btn-secondary" onClick={onRequestNotifications}>
              <Bell size={15} />
              <span>Ativar</span>
            </button>
          )}
        </div>

        <div
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)' }}>
            Backup local (JSON)
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={onExportBackup}>
              <Download size={15} />
              <span>Exportar backup</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={15} />
              <span>Importar backup</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div
          style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)' }}>
              Modo demonstração (Portfólio)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-soft)', marginTop: 2 }}>
              Preenche gráficos e agenda com dados fictícios para visualização rápida. Seus dados
              reais ficam salvos para restaurar depois.
            </div>
          </div>

          {settings.demoModeActive ? (
            <button type="button" className="btn btn-danger" onClick={onExitDemoData}>
              <RotateCcw size={15} />
              <span>
                {hasRealBackup ? 'Sair do modo demo e restaurar meus dados' : 'Limpar dados demo'}
              </span>
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={onLoadDemoData}>
              <Sparkles size={15} />
              <span>Carregar dados de demonstração</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

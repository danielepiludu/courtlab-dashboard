import { useEffect, useState } from 'react';
import { MapPin, Plane, Zap } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Field } from '@/components/ui/misc';
import { newGame, saveGame } from '@/db/repo';
import { nowHHMM, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { toast } from '@/store/feedback';

/** Crea al volo una partita con data e ora attuali. */
export function QuickGameSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [opponent, setOpponent] = useState('');
  const [home, setHome] = useState(true);
  useEffect(() => {
    if (open) {
      setOpponent('');
      setHome(true);
    }
  }, [open]);

  const create = async () => {
    if (!opponent.trim()) return;
    const id = await saveGame({ ...newGame(todayISO(), nowHHMM()), opponent, home, notes: 'Creata al volo' });
    haptic.confirm();
    toast('Partita creata e selezionata', 'success');
    onCreated(id);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Partita al volo"
      subtitle="Data e ora di adesso"
      footer={
        <Button variant="primary" size="lg" className="w-full" icon={<Zap size={20} />} disabled={!opponent.trim()} onClick={create}>
          Crea e seleziona
        </Button>
      }
    >
      <Field label="Avversario">
        <input
          className="input"
          autoFocus
          autoCapitalize="words"
          placeholder="es. Virtus Siena"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
      </Field>
      <span className="label">Campo</span>
      <Segmented
        value={home ? 'home' : 'away'}
        onChange={(v) => setHome(v === 'home')}
        options={[
          { value: 'home', label: (<><MapPin size={16} /> Casa</>) },
          { value: 'away', label: (<><Plane size={16} /> Trasferta</>) },
        ]}
      />
    </Sheet>
  );
}

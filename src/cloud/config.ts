/**
 * Courtlab Cloud (Supabase): indirizzo del progetto e chiave PUBBLICA ("publishable"/"anon").
 * La chiave pubblica è fatta per stare nell'app: i dati sono protetti dalle regole in supabase/schema.sql.
 * Non inserire MAI qui la chiave segreta / service_role.
 * Si possono anche passare in build con VITE_SUPABASE_URL e VITE_SUPABASE_KEY.
 */
const URL_DEFAULT = 'https://zsqaingvzduidyiuonre.supabase.co';
const KEY_DEFAULT = 'sb_publishable_CS8Rgto24ggRSj5iQC7s4A_niRSUph_';

export const CLOUD = {
  url: ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || URL_DEFAULT).replace(/\/+$/, ''),
  key: (import.meta.env.VITE_SUPABASE_KEY as string | undefined) || KEY_DEFAULT,
};

export const cloudConfigured = () => !!(CLOUD.url && CLOUD.key);

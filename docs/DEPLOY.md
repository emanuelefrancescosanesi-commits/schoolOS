# Mettere SchoolOS online (Vercel)

1. Account su vercel.com con «Continue with GitHub».
2. **Add New → Project** → importa `schoolOS` (branch `main`).
3. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (vedi `.env.example`). Mai la secret key.
4. **Deploy**. Annota l'indirizzo (es. `https://schoolos-xxx.vercel.app`).
5. Supabase → Authentication → URL Configuration: **Site URL** = quell'indirizzo; **Redirect URLs** = `https://<indirizzo>/**`.
6. Estensione → Opzioni → incolla l'indirizzo.

Il database resta quello di Supabase: le migrazioni si applicano a mano nello SQL Editor.

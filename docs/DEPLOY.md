# Mettere SchoolOS online (Vercel)

1. Account su vercel.com con «Continue with GitHub».
2. **Add New → Project** → importa `schoolOS` (branch `main`).
3. Le due variabili pubbliche di Supabase sono già in `vercel.json` (URL e publishable key, pubbliche per design): non serve inserirle a mano. Mai la secret key.
4. **Deploy**. Annota l'indirizzo (es. `https://schoolos-xxx.vercel.app`).
5. Supabase → Authentication → URL Configuration: **Site URL** = quell'indirizzo; **Redirect URLs** = `https://<indirizzo>/**`.
6. Estensione → Opzioni → incolla l'indirizzo.

Il database resta quello di Supabase: le migrazioni si applicano a mano nello SQL Editor.

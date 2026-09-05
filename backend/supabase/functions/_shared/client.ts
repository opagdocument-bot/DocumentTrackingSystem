// Two clients, two purposes — never mixed.
//
// `userClient` acts as whoever called the function: it can only do what RLS
// already allows them (read everything, write nothing). It exists solely to
// answer "who is this, really?" — Supabase verifies the JWT itself, so a
// caller cannot claim to be someone else by editing a request body.
//
// `serviceClient` bypasses every RLS rule. It is used only after this
// module's own role/custody check has already decided the action is
// allowed — never in response to anything the client asserts about itself.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { Role } from './rules.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export interface Caller {
  id: string
  name: string
  role: Role
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

/**
 * Who is actually calling, and what can they do. Reads the caller's own
 * profile through their own JWT (not the service role), so this can never
 * return a role the person signed in as isn't really theirs.
 */
export async function identifyCaller(req: Request): Promise<Caller> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new AuthError('Missing Authorization header')

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) throw new AuthError('Not signed in')

  const { data: profile, error: profileErr } = await userClient
    .from('profiles')
    .select('id, name, role')
    .eq('id', userData.user.id)
    .single()
  if (profileErr || !profile) throw new AuthError('No profile for this account', 403)

  return { id: profile.id, name: profile.name, role: profile.role as Role }
}

/** The privileged client — every write goes through this one, and only
 *  after identifyCaller() plus a rules.ts check has approved it. */
export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

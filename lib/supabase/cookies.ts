/** Form, in der @supabase/ssr Cookies zum Setzen übergibt. */
export interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

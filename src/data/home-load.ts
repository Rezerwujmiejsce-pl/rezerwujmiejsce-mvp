export async function loadPublicHome<S, O, V, C = null>(input: {
  session: () => Promise<S>;
  occasions: () => Promise<O>;
  venues: () => Promise<V>;
  copy?: () => Promise<C>;
}): Promise<{ session: S; occasions: O; venues: V; copy: C | null }> {
  const [session, occasions, venues, copy] = await Promise.all([
    input.session(),
    input.occasions(),
    input.venues(),
    input.copy ? input.copy() : Promise.resolve(null),
  ]);
  return { session, occasions, venues, copy };
}

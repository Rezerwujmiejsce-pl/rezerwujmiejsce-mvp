export async function loadPublicHome<S, O, V>(input: {
  session: () => Promise<S>;
  occasions: () => Promise<O>;
  venues: () => Promise<V>;
}): Promise<{ session: S; occasions: O; venues: V }> {
  const [session, occasions, venues] = await Promise.all([
    input.session(),
    input.occasions(),
    input.venues(),
  ]);
  return { session, occasions, venues };
}

export default function StoreAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string;
}) {
  const initial = (name?.[0] || "S").toUpperCase();
  return (
    <div
      className={`size-16 rounded-full overflow-hidden ring-1 ring-black/5 bg-gray-100 flex items-center justify-center`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-lg font-semibold">{initial}</span>
      )}
    </div>
  );
}

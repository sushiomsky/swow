export default function ErrorText({ message }) {
  if (!message) return null;
  return <p className="text-sm text-rose-300">{message}</p>;
}

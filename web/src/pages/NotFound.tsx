import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-5xl font-black text-pitch-500">404</h1>
      <p className="mt-2 muted">That page is out — caught behind.</p>
      <Link to="/" className="btn-primary mt-6">Back to home</Link>
    </div>
  );
}

import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import MatchCenter from "@/pages/MatchCenter";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import Tournaments from "@/pages/Tournaments";
import TournamentDetail from "@/pages/TournamentDetail";
import Login from "@/pages/Login";
import Scoring from "@/pages/Scoring";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import { useAppDispatch, useAppSelector } from "@/store";
import { loadCurrentUser } from "@/store/authSlice";
import { tokenStore } from "@/lib/api";

function RequireAdmin({ children }: { children: JSX.Element }) {
  const user = useAppSelector((s) => s.auth.user);
  const status = useAppSelector((s) => s.auth.status);
  if (status === "loading") return null;
  if (!user || user.role === "PUBLIC") return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (tokenStore.access) dispatch(loadCurrentUser());
  }, [dispatch]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches/:id" element={<MatchCenter />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:id" element={<TeamDetail />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/matches/:id/score"
          element={
            <RequireAdmin>
              <Scoring />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

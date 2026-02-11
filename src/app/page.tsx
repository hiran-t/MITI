import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/components/features/dashboard/Dashboard"), {
  ssr: false,
});

export default function Home() {
  return <Dashboard />;
}

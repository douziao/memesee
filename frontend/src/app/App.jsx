import AppLayout from "./AppLayout";
import { useAppRuntime } from "./runtime";

function App() {
  const appLayoutProps = useAppRuntime();
  return <AppLayout {...appLayoutProps} />;
}

export default App;

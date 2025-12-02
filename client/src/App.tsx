import { ChakraProvider } from '@chakra-ui/react';
import { AuthWrapper } from './components/AuthWrapper';
import { system } from './theme';
import './styles/App.css';

function App() {
  return (
    <ChakraProvider value={system}>
      <AuthWrapper />
    </ChakraProvider>
  );
}

export default App;

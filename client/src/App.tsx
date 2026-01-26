import { useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { AuthWrapper } from './components/AuthWrapper';
import { system } from './theme';
import { useGameStore } from './store/gameStore';
import './styles/App.css';

function App() {
  const loadCharacters = useGameStore(state => state.loadCharacters);
  const isCharactersLoaded = useGameStore(state => state.isCharactersLoaded);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  if (!isCharactersLoaded) {
    return (
      <ChakraProvider value={system}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          Loading characters...
        </div>
      </ChakraProvider>
    );
  }

  return (
    <ChakraProvider value={system}>
      <AuthWrapper />
    </ChakraProvider>
  );
}

export default App;

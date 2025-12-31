import { characterRepository, ICharacterData } from '../database/CharacterRepository.js';

/**
 * In-memory cache for characters to avoid DB queries during gameplay
 */
class CharacterService {
  private charactersCache: Map<string, ICharacterData>;
  private allCharacterIds: string[];
  private isInitialized: boolean;

  constructor() {
    this.charactersCache = new Map();
    this.allCharacterIds = [];
    this.isInitialized = false;
  }

  /**
   * Load all characters from database into memory
   * Called once on server startup
   */
  async initialize(): Promise<void> {
    console.log('🎮 Loading characters from database...');
    const characters = await characterRepository.getAllCharacters();

    this.charactersCache.clear();
    this.allCharacterIds = [];

    for (const character of characters) {
      this.charactersCache.set(character.id, character);
      this.allCharacterIds.push(character.id);
    }

    this.isInitialized = true;
    console.log(`✅ Loaded ${characters.length} characters into memory cache`);
    console.log(`📦 Cache contains: ${Array.from(this.charactersCache.keys()).join(', ')}`);
  }

  /**
   * Get character by ID (from cache)
   */
  getCharacterById(id: string): ICharacterData | undefined {
    if (!this.isInitialized) {
      throw new Error('CharacterService not initialized. Call initialize() first.');
    }
    return this.charactersCache.get(id);
  }

  /**
   * Get all character IDs (for shop generation)
   */
  getAllCharacterIds(): string[] {
    if (!this.isInitialized) {
      throw new Error('CharacterService not initialized. Call initialize() first.');
    }
    return [...this.allCharacterIds];
  }

  /**
   * Get all characters (for API responses)
   */
  getAllCharacters(): ICharacterData[] {
    if (!this.isInitialized) {
      throw new Error('CharacterService not initialized. Call initialize() first.');
    }
    return Array.from(this.charactersCache.values());
  }

  /**
   * Refresh cache from database (manual trigger)
   */
  async refresh(): Promise<void> {
    await this.initialize();
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getCacheStats() {
    return {
      size: this.charactersCache.size,
      characterIds: Array.from(this.charactersCache.keys()),
      isInitialized: this.isInitialized,
    };
  }
}

// Export singleton instance
export const characterService = new CharacterService();

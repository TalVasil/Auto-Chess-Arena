import { query } from './Db.js';

export interface ICharacterAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  damage?: number;
  healing?: number;
  effect?: string;
}

export interface ICharacterData {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  rarity: string;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  abilities: ICharacterAbility[];
}

export class CharacterRepository {
  /**
   * Get all active characters with their abilities
   * Used for server cache initialization
   */
  async getAllCharacters(): Promise<ICharacterData[]> {
    const charactersResult = await query(
      `SELECT id, name, emoji, cost, rarity, attack, defense, hp, speed
       FROM characters
       WHERE is_active = true
       ORDER BY cost, name`
    );

    const characters: ICharacterData[] = [];

    for (const charRow of charactersResult.rows) {
      const abilitiesResult = await query(
        `SELECT ability_id as id, name, description, cooldown, damage, healing, effect
         FROM character_abilities
         WHERE character_id = $1
         ORDER BY sort_order`,
        [charRow.id]
      );

      characters.push({
        ...charRow,
        abilities: abilitiesResult.rows,
      });
    }

    return characters;
  }

  /**
   * Get character by ID with abilities
   */
  async getCharacterById(id: string): Promise<ICharacterData | null> {
    const charResult = await query(
      `SELECT id, name, emoji, cost, rarity, attack, defense, hp, speed
       FROM characters
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (charResult.rows.length === 0) return null;

    const abilitiesResult = await query(
      `SELECT ability_id as id, name, description, cooldown, damage, healing, effect
       FROM character_abilities
       WHERE character_id = $1
       ORDER BY sort_order`,
      [id]
    );

    return {
      ...charResult.rows[0],
      abilities: abilitiesResult.rows,
    };
  }

  /**
   * Get all character IDs (for shop generation)
   */
  async getAllCharacterIds(): Promise<string[]> {
    const result = await query(
      `SELECT id FROM characters WHERE is_active = true ORDER BY cost, name`
    );
    return result.rows.map(row => row.id);
  }
}

// Export singleton instance
export const characterRepository = new CharacterRepository();

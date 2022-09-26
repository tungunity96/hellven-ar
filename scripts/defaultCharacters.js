import { AtlasType, RaceType, ClassType, WeaponType } from "./enums.js";

export const defaultCharacters = {
  0: {
    characterId: 0,
    race: RaceType.Human,
    class: ClassType.Knight,
    hair: 4,
    eye: 4,
    weapon: WeaponType.Greatsword,
    isFemale: false,
  },
  1: {
    characterId: 1,
    race: RaceType.Elf,
    class: ClassType.Mage,
    hair: 2,
    eye: 2,
    weapon: WeaponType.Magicstaff,
    isFemale: true,
  },
};

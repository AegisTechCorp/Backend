import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Trouve un utilisateur par email
   * @param email - Email de l'utilisateur
   * @returns L'utilisateur ou null si non trouvé
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Trouve un utilisateur par ID
   * @param id - UUID de l'utilisateur
   * @returns L'utilisateur ou null si non trouvé
   */
  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  /**
   * Crée un nouvel utilisateur
   * @param userData - Données de l'utilisateur
   * @returns L'utilisateur créé
   */
  async create(userData: {
    email: string;
    authHash: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<User> {
    // Vérifier si l'email existe déjà
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const user = this.userRepository.create({
      ...userData,
      dateOfBirth: userData.dateOfBirth
        ? new Date(userData.dateOfBirth)
        : undefined,
    });

    return await this.userRepository.save(user);
  }

  /**
   * Met à jour un utilisateur
   * @param id - UUID de l'utilisateur
   * @param userData - Données à mettre à jour
   * @returns L'utilisateur mis à jour
   */
  async update(
    id: string,
    userData: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      isActive: boolean;
    }>,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new ConflictException('Utilisateur non trouvé');
    }

    Object.assign(user, {
      ...userData,
      dateOfBirth: userData.dateOfBirth
        ? new Date(userData.dateOfBirth)
        : user.dateOfBirth,
    });

    return await this.userRepository.save(user);
  }

  /**
   * Supprime un utilisateur
   * @param id - UUID de l'utilisateur
   */
  async delete(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }
}

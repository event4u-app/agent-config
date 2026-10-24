import { Entity, ManyToOne } from 'typeorm';

import { User } from './user';

@Entity({ name: 'blog_posts', schema: 'public' })
export class Post {
    @ManyToOne((type) => User, (user) => user.posts)
    author!: User;
}

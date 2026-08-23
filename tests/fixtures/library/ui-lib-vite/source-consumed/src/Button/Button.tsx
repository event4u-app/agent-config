// Deliberately minimal: the fixture's subject is the PACKAGE SURFACE, not the component.
// A richer component would invite the checker to grow a parser, which step 1.2 excludes.
import * as React from 'react';

export interface ButtonProps {
    readonly label: string;
    readonly onPress?: () => void;
}

export const Button = ({ label, onPress }: ButtonProps): React.ReactElement => (
    <button type="button" onClick={onPress}>
        {label}
    </button>
);

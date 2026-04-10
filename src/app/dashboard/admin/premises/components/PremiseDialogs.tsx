'use client';

import * as React from 'react';
import { CreatePremiseDialog } from './dialogs/CreatePremiseDialog';
import { EditPremiseDialog } from './dialogs/EditPremiseDialog';
import { DeletePremiseDialog, ChangeOwnerDialog, DuplicateUserDialog } from './dialogs/PremiseActionDialogs';

interface PremiseDialogsProps {
    // Create Dialog State
    isCreateOpen: boolean;
    setIsCreateOpen: (open: boolean) => void;
    creationMode: 'new' | 'existing';
    setCreationMode: (mode: 'new' | 'existing') => void;
    newOwnerForm: any;
    existingUserForm: any;
    handleCreateSubmit: (data: any) => void;

    // Edit Dialog State
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    editForm: any;
    handleEditSubmit: (data: any) => void;
    selectedPremise: any;

    // Delete Dialog State
    isDeleteAlertOpen: boolean;
    setIsDeleteAlertOpen: (open: boolean) => void;
    handleDeleteConfirm: () => void;

    // Change Owner Dialog State
    isChangeOwnerOpen: boolean;
    setIsChangeOwnerOpen: (open: boolean) => void;
    premiseToChangeOwner: any;
    newOwnerEmail: string | null;
    setNewOwnerEmail: (email: string) => void;
    handleChangeOwnerSubmit: (e: React.FormEvent) => void;

    // Duplicate User Dialog State
    showDuplicateUserDialog: boolean;
    setShowDuplicateUserDialog: (show: boolean) => void;

    // Shared Props
    isSubmitting: boolean;
    categories: any[];
    cities: any[];
    filteredCities: any[];
    citySearch: string;
    setCitySearch: (search: string) => void;
}

export function PremiseDialogs(props: PremiseDialogsProps) {
    return (
        <>
            <CreatePremiseDialog
                isOpen={props.isCreateOpen}
                setIsOpen={props.setIsCreateOpen}
                creationMode={props.creationMode}
                setCreationMode={props.setCreationMode}
                newOwnerForm={props.newOwnerForm}
                existingUserForm={props.existingUserForm}
                handleCreateSubmit={props.handleCreateSubmit}
                isSubmitting={props.isSubmitting}
                categories={props.categories}
                cities={props.cities}
                filteredCities={props.filteredCities}
                citySearch={props.citySearch}
                setCitySearch={props.setCitySearch}
            />

            <EditPremiseDialog
                isOpen={props.isEditOpen}
                setIsOpen={props.setIsEditOpen}
                editForm={props.editForm}
                handleEditSubmit={props.handleEditSubmit}
                selectedPremise={props.selectedPremise}
                isSubmitting={props.isSubmitting}
                categories={props.categories}
                cities={props.cities}
                filteredCities={props.filteredCities}
                citySearch={props.citySearch}
                setCitySearch={props.setCitySearch}
            />

            <DeletePremiseDialog
                isOpen={props.isDeleteAlertOpen}
                setIsOpen={props.setIsDeleteAlertOpen}
                handleDeleteConfirm={props.handleDeleteConfirm}
                selectedPremise={props.selectedPremise}
                isSubmitting={props.isSubmitting}
            />

            <ChangeOwnerDialog
                isOpen={props.isChangeOwnerOpen}
                setIsOpen={props.setIsChangeOwnerOpen}
                handleChangeOwnerSubmit={props.handleChangeOwnerSubmit}
                premiseToChangeOwner={props.premiseToChangeOwner}
                newOwnerEmail={props.newOwnerEmail}
                setNewOwnerEmail={props.setNewOwnerEmail}
                isSubmitting={props.isSubmitting}
            />

            <DuplicateUserDialog
                isOpen={props.showDuplicateUserDialog}
                setIsOpen={props.setShowDuplicateUserDialog}
            />
        </>
    );
}

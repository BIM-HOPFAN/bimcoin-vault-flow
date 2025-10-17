import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Save, X, CheckCircle, XCircle, Clock, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface Task {
  id?: string;
  title: string;
  description: string;
  reward_amount: number;
  task_type: string;
  external_url?: string;
  is_active: boolean;
  daily_limit: number;
  verification_type?: string;
  verification_data?: any;
}

const Admin = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const { toast } = useToast();

  const [formData, setFormData] = useState<Task>({
    title: '',
    description: '',
    reward_amount: 0,
    task_type: 'social',
    external_url: '',
    is_active: true,
    daily_limit: 1,
    verification_type: 'manual',
    verification_data: {}
  });

  const taskTypes = [
    { value: 'social', label: 'Social Media' },
    { value: 'trading', label: 'Trading' },
    { value: 'referral', label: 'Referral' },
    { value: 'survey', label: 'Survey' },
    { value: 'external', label: 'External Action' }
  ];

  const verificationTypes = [
    { value: 'manual', label: 'Manual (Honor System)' },
    { value: 'url_visit', label: 'URL Visit Tracking' },
    { value: 'social_follow', label: 'Social Media Follow' },
    { value: 'deposit_check', label: 'Deposit Verification' },
    { value: 'time_based', label: 'Time-based Completion' }
  ];

  useEffect(() => {
    fetchTasks();
    fetchWithdrawals();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const result = await bimCoinAPI.getAdminTasks();
      if (result.success) {
        setTasks(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*, users(wallet_address)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawal requests",
        variant: "destructive",
      });
    }
  };

  const approveWithdrawal = async (id: string) => {
    if (!confirm('Approve this withdrawal? The blockchain transaction will be processed automatically.')) {
      return;
    }

    try {
      // First update status to approved
      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      toast({
        title: "Processing...",
        description: "Withdrawal approved. Processing blockchain transaction...",
      });

      // Trigger automatic payout processing
      const { data, error: processError } = await supabase.functions.invoke('process-withdrawal', {
        body: { withdrawal_id: id }
      });

      if (processError || !data?.success) {
        throw new Error(data?.error || processError?.message || 'Processing failed');
      }

      toast({
        title: "Success!",
        description: `Withdrawal completed automatically. TX: ${data.tx_hash}`,
      });
      
      fetchWithdrawals();
    } catch (error) {
      console.error('Failed to process withdrawal:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process withdrawal",
        variant: "destructive",
      });
      
      // Refresh to show updated status
      fetchWithdrawals();
    }
  };

  const rejectWithdrawal = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Withdrawal request rejected",
      });
      
      fetchWithdrawals();
    } catch (error) {
      console.error('Failed to reject withdrawal:', error);
      toast({
        title: "Error",
        description: "Failed to reject withdrawal",
        variant: "destructive",
      });
    }
  };

  const retryWithdrawal = async (id: string) => {
    if (!confirm('Retry processing this withdrawal?')) {
      return;
    }

    try {
      // Reset to approved status
      await supabase
        .from('withdrawals')
        .update({ 
          status: 'approved',
          rejection_reason: null
        })
        .eq('id', id);

      // Trigger processing
      const { data, error: processError } = await supabase.functions.invoke('process-withdrawal', {
        body: { withdrawal_id: id }
      });

      if (processError || !data?.success) {
        throw new Error(data?.error || processError?.message || 'Processing failed');
      }

      toast({
        title: "Success!",
        description: `Withdrawal completed. TX: ${data.tx_hash}`,
      });
      
      fetchWithdrawals();
    } catch (error) {
      console.error('Failed to retry withdrawal:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to retry withdrawal",
        variant: "destructive",
      });
      
      fetchWithdrawals();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = editingTask 
        ? await bimCoinAPI.updateTask(editingTask.id!, formData)
        : await bimCoinAPI.createTask(formData);

      if (result.success) {
        toast({
          title: "Success",
          description: `Task ${editingTask ? 'updated' : 'created'} successfully`,
        });
        await fetchTasks();
        resetForm();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingTask ? 'update' : 'create'} task`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      const result = await bimCoinAPI.deleteTask(taskId);
      if (result.success) {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
        await fetchTasks();
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({ ...task });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      reward_amount: 0,
      task_type: 'social',
      external_url: '',
      is_active: true,
      daily_limit: 1,
      verification_type: 'manual',
      verification_data: {}
    });
    setShowForm(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'social': return 'bg-blue-500/20 text-blue-400';
      case 'trading': return 'bg-green-500/20 text-green-400';
      case 'referral': return 'bg-purple-500/20 text-purple-400';
      case 'survey': return 'bg-orange-500/20 text-orange-400';
      case 'external': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/20 text-blue-400"><Clock className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Administration Panel</h1>
          <p className="text-muted-foreground">Manage tasks and withdrawal requests</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="withdrawals">
            Withdrawals
            {withdrawals.filter(w => w.status === 'pending').length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {withdrawals.filter(w => w.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex justify-end">
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-primary hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>

          {/* Task Form */}
          {showForm && (
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</CardTitle>
            <CardDescription>
              Configure task details and verification settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reward">Reward Amount (OBA)</Label>
                  <Input
                    id="reward"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.reward_amount}
                    onChange={(e) => setFormData({ ...formData, reward_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Task Type</Label>
                  <Select value={formData.task_type} onValueChange={(value) => setFormData({ ...formData, task_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification">Verification Type</Label>
                  <Select value={formData.verification_type} onValueChange={(value) => setFormData({ ...formData, verification_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {verificationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_limit">Daily Limit</Label>
                  <Input
                    id="daily_limit"
                    type="number"
                    min="1"
                    value={formData.daily_limit}
                    onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="external_url">External URL (Optional)</Label>
                  <Input
                    id="external_url"
                    type="url"
                    value={formData.external_url}
                    onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what users need to do"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Task Active</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                  <Save className="w-4 h-4 mr-2" />
                  {editingTask ? 'Update' : 'Create'} Task
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
          )}

          {/* Tasks List */}
          <Card className="enhanced-card">
        <CardHeader>
          <CardTitle>Existing Tasks</CardTitle>
          <CardDescription>
            Manage all tasks in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tasks found</div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      <Badge className={getTypeColor(task.task_type)}>
                        {task.task_type}
                      </Badge>
                      {!task.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-warning">+{task.reward_amount} OBA</span>
                      <span>Daily Limit: {task.daily_limit}</span>
                      <span>Verification: {task.verification_type}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(task)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(task.id!)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>
                Review and process user withdrawal requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No withdrawal requests
                </div>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div 
                      key={withdrawal.id}
                      className="flex flex-col gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-primary" />
                            <span className="font-medium">
                              {withdrawal.bim_amount} BIM → {' '}
                              {withdrawal.withdrawal_type === 'ton' 
                                ? `${withdrawal.ton_amount} TON`
                                : `${withdrawal.jetton_amount} Bimcoin`
                              }
                            </span>
                            {getStatusBadge(withdrawal.status)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Wallet: {withdrawal.wallet_address}</div>
                            <div>Total deducted: {withdrawal.total_bim_deducted} BIM</div>
                            {withdrawal.penalty_amount > 0 && (
                              <div className="text-warning">
                                Penalty: {withdrawal.penalty_amount} BIM
                              </div>
                            )}
                            <div>
                              Requested: {new Date(withdrawal.created_at).toLocaleString()}
                            </div>
                            {withdrawal.tx_hash && (
                              <div className="text-primary">TX: {withdrawal.tx_hash}</div>
                            )}
                            {withdrawal.rejection_reason && (
                              <div className="text-destructive">
                                Reason: {withdrawal.rejection_reason}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {withdrawal.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-400 hover:text-green-300"
                                onClick={() => approveWithdrawal(withdrawal.id)}
                                title="Approve and auto-process blockchain transaction"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve & Process
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => rejectWithdrawal(withdrawal.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {withdrawal.status === 'rejected' && withdrawal.rejection_reason?.includes('treasury balance') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-400 hover:text-blue-300"
                              onClick={() => retryWithdrawal(withdrawal.id)}
                              title="Retry processing after funding treasury"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;